const crypto = require('crypto');
const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const env = require('../config/env');
const { presignS3Get } = require('../utils/sigv4');

// Keys are generated server-side; this pattern also blocks path traversal on read.
const KEY_PATTERN = /^[a-z0-9]+(?:\/[a-z0-9-]+)*\/[a-z0-9-]+\.(?:jpg|png)$/;

function isValidKey(key) {
  return typeof key === 'string' && KEY_PATTERN.test(key) && !key.includes('..');
}

const MIME = { jpg: 'image/jpeg', png: 'image/png' };
const contentType = (key) => MIME[key.split('.').pop()] ?? 'application/octet-stream';

/**
 * Signed URLs expire at the end of the hour after `ttl`, so the same link is reused
 * for up to an hour and browsers can cache images.
 */
function expiryFor(ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  return Math.ceil((now + ttlSeconds) / 3600) * 3600;
}

/**
 * Private file storage on local disk (development). Files are never served statically;
 * clients get short-lived HMAC-signed URLs (spec §12 "images are private by default").
 */
class LocalStorage {
  constructor({ root, publicRoot, urlSecret, urlTtlSeconds }) {
    this.root = root;
    this.publicRoot = publicRoot;
    this.urlSecret = urlSecret;
    this.urlTtlSeconds = urlTtlSeconds;
  }

  pathFor(key) {
    if (!isValidKey(key)) throw new Error(`Invalid storage key: ${key}`);
    return path.join(this.root, ...key.split('/'));
  }

  async put(key, buffer) {
    const file = this.pathFor(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buffer, { flag: 'wx' }); // never overwrite
  }

  async copy(fromKey, toKey) {
    const target = this.pathFor(toKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(this.pathFor(fromKey), target, constants.COPYFILE_EXCL);
  }

  /** Public catalogue assets (e.g. admin-uploaded pattern tiles); returns their URL. */
  async putPublic(key, buffer) {
    if (!isValidKey(key)) throw new Error(`Invalid storage key: ${key}`);
    const file = path.join(this.publicRoot, ...key.split('/'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buffer, { flag: 'wx' });
    return `/static/${key}`;
  }

  async removePublic(url) {
    if (!url?.startsWith('/static/patterns/custom/')) return;
    const key = url.replace(/^\/static\//, '');
    if (!isValidKey(key)) return;
    await fs.rm(path.join(this.publicRoot, ...key.split('/')), { force: true });
  }

  async remove(key) {
    await fs.rm(this.pathFor(key), { force: true });
    // Tidy up the now-empty project folder; ignore if other files remain
    await fs.rmdir(path.dirname(this.pathFor(key))).catch(() => undefined);
  }

  signature(key, exp) {
    return crypto.createHmac('sha256', this.urlSecret).update(`${key}:${exp}`).digest('base64url');
  }

  signedUrl(key) {
    const exp = expiryFor(this.urlTtlSeconds);
    return `/api/v1/files/${key}?exp=${exp}&sig=${this.signature(key, exp)}`;
  }

  /** Returns true only for an untampered, unexpired signature. */
  verify(key, exp, sig) {
    const expNum = Number(exp);
    if (!isValidKey(key) || !Number.isInteger(expNum) || typeof sig !== 'string') return false;
    if (expNum < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.signature(key, expNum));
    const given = Buffer.from(sig);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  }
}

/**
 * Private files in Amazon S3 (production). The bucket stays private; the browser gets
 * presigned GET URLs. Public catalogue assets live under the `public/` prefix, which the
 * bucket policy (or a CDN) exposes; see docs/deployment.md.
 */
class S3Storage {
  constructor({
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    urlTtlSeconds,
    publicBaseUrl,
  }) {
    // Loaded lazily so local development and tests don't need the AWS SDK
    const { S3Client } = require('@aws-sdk/client-s3');
    const credentials = accessKeyId ? { accessKeyId, secretAccessKey, sessionToken } : undefined;
    this.client = new S3Client({ region, credentials });
    this.bucket = bucket;
    this.region = region;
    this.credentials = { accessKeyId, secretAccessKey, sessionToken };
    this.urlTtlSeconds = urlTtlSeconds;
    this.publicBaseUrl = (publicBaseUrl || `https://${bucket}.s3.${region}.amazonaws.com`).replace(
      /\/$/,
      '',
    );
  }

  command(name, input) {
    const commands = require('@aws-sdk/client-s3');
    return this.client.send(new commands[name]({ Bucket: this.bucket, ...input }));
  }

  async put(key, buffer) {
    if (!isValidKey(key)) throw new Error(`Invalid storage key: ${key}`);
    await this.command('PutObjectCommand', {
      Key: key,
      Body: buffer,
      ContentType: contentType(key),
      CacheControl: 'private, max-age=3600',
      ServerSideEncryption: 'AES256',
    });
  }

  async copy(fromKey, toKey) {
    if (!isValidKey(fromKey) || !isValidKey(toKey)) throw new Error('Invalid storage key');
    await this.command('CopyObjectCommand', {
      Key: toKey,
      CopySource: `${this.bucket}/${fromKey}`,
      ServerSideEncryption: 'AES256',
    });
  }

  async remove(key) {
    if (!isValidKey(key)) return;
    await this.command('DeleteObjectCommand', { Key: key });
  }

  async putPublic(key, buffer) {
    if (!isValidKey(key)) throw new Error(`Invalid storage key: ${key}`);
    await this.command('PutObjectCommand', {
      Key: `public/${key}`,
      Body: buffer,
      ContentType: contentType(key),
      CacheControl: 'public, max-age=604800, immutable',
    });
    return `${this.publicBaseUrl}/public/${key}`;
  }

  async removePublic(url) {
    const prefix = `${this.publicBaseUrl}/public/`;
    if (!url?.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    if (isValidKey(key)) await this.command('DeleteObjectCommand', { Key: `public/${key}` });
  }

  signedUrl(key) {
    const expiresAt = expiryFor(this.urlTtlSeconds);
    // Sign from the start of the hour so the URL is stable (cacheable) for that hour
    const signedAt = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    return presignS3Get({
      bucket: this.bucket,
      region: this.region,
      key,
      ...this.credentials,
      expiresIn: expiresAt - signedAt.getTime() / 1000,
      date: signedAt,
    });
  }

  /** S3 checks its own signatures; the API's /files route is only for local storage. */
  verify() {
    return false;
  }

  pathFor() {
    throw new Error('Files are in S3, not on local disk');
  }
}

function createStorage() {
  if (env.storageDriver === 's3') {
    if (!env.aws.bucket) throw new Error('STORAGE_DRIVER=s3 requires AWS_S3_BUCKET');
    return new S3Storage({ ...env.aws, urlTtlSeconds: env.storage.urlTtlSeconds });
  }
  return new LocalStorage({
    root: env.storage.uploadDir,
    publicRoot: path.join(__dirname, '../../public'),
    urlSecret: env.storage.urlSecret,
    urlTtlSeconds: env.storage.urlTtlSeconds,
  });
}

const storage = createStorage();

module.exports = { storage, LocalStorage, S3Storage, isValidKey };
