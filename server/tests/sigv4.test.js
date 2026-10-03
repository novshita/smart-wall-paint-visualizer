const { presignS3Get } = require('../src/utils/sigv4');

describe('S3 presigned URLs (SigV4)', () => {
  it('matches the example in the AWS documentation', () => {
    // "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)", S3 API reference
    const url = presignS3Get({
      bucket: 'examplebucket',
      region: 'us-east-1',
      key: 'test.txt',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      expiresIn: 86400,
      date: new Date('2013-05-24T00:00:00Z'),
    });
    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt' +
        '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('uses the regional host outside us-east-1 and adds session tokens', () => {
    const url = presignS3Get({
      bucket: 'b',
      region: 'ap-south-1',
      key: 'projects/x/original.jpg',
      accessKeyId: 'A',
      secretAccessKey: 'S',
      sessionToken: 'tok/en',
      expiresIn: 60,
    });
    expect(url.startsWith('https://b.s3.ap-south-1.amazonaws.com/projects/x/original.jpg?')).toBe(
      true,
    );
    expect(url).toContain('X-Amz-Security-Token=tok%2Fen');
  });
});

describe('S3Storage', () => {
  const { S3Storage } = require('../src/services/storage.service');
  const s3 = new S3Storage({
    bucket: 'swpv-test',
    region: 'eu-west-2',
    accessKeyId: 'AKIA',
    secretAccessKey: 'secret',
    urlTtlSeconds: 3600,
  });

  it('presigns private image URLs that stay stable within the hour', () => {
    const a = s3.signedUrl('projects/abc/original.jpg');
    const b = s3.signedUrl('projects/abc/original.jpg');
    expect(a).toBe(b);
    expect(a).toMatch(
      /^https:\/\/swpv-test\.s3\.eu-west-2\.amazonaws\.com\/projects\/abc\/original\.jpg\?/,
    );
    const expires = Number(new URL(a).searchParams.get('X-Amz-Expires'));
    expect(expires).toBeGreaterThanOrEqual(3600);
    expect(expires).toBeLessThanOrEqual(7200);
  });

  it('never verifies URLs itself (S3 does)', () => {
    expect(s3.verify('projects/abc/original.jpg', 1, 'x')).toBe(false);
  });
});
