const crypto = require('crypto');
const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const env = require('../config/env');

// Keys are generated server-side; this pattern also blocks path traversal on read.
const KEY_PATTERN = /^[a-z0-9]+(?:\/[a-z0-9-]+)*\/[a-z0-9-]+\.(?:jpg|png)$/;

function isValidKey(key) {
  return typeof key === 'string' && KEY_PATTERN.test(key) && !key.includes('..');
}

/**
 * Private file storage on local disk. Files are never served statically; clients get
 * short-lived HMAC-signed URLs (spec §12 "images are private by default (signed URLs)").
 * An S3 implementation with the same interface is added at deployment.
 */
class LocalStorage {
  constructor({ root, urlSecret, urlTtlSeconds }) {
    this.root = root;
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

  async remove(key) {
    await fs.rm(this.pathFor(key), { force: true });
    // Tidy up the now-empty project folder; ignore if other files remain
    await fs.rmdir(path.dirname(this.pathFor(key))).catch(() => undefined);
  }

  signature(key, exp) {
    return crypto.createHmac('sha256', this.urlSecret).update(`${key}:${exp}`).digest('base64url');
  }

  signedUrl(key) {
    const exp = Math.floor(Date.now() / 1000) + this.urlTtlSeconds;
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

const storage = new LocalStorage({
  root: env.storage.uploadDir,
  urlSecret: env.storage.urlSecret,
  urlTtlSeconds: env.storage.urlTtlSeconds,
});

module.exports = { storage, LocalStorage, isValidKey };
