const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const required = ['MONGODB_URI', 'JWT_SECRET'];
const isTest = process.env.NODE_ENV === 'test';

if (!isTest) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest,
  port: Number(process.env.PORT) || 5050,
  mongoUri: process.env.MONGODB_URI,
  jwt: {
    secret: process.env.JWT_SECRET || (isTest ? 'test-secret' : undefined),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:4200')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 10,
  storage: {
    // Local disk storage root (development). S3 is configured via aws.* at deployment.
    uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')),
    // Secret for signing private file URLs; falls back to a value derived from JWT_SECRET
    urlSecret: process.env.FILE_URL_SECRET || `${process.env.JWT_SECRET || 'test-secret'}:files`,
    urlTtlSeconds: Number(process.env.FILE_URL_TTL_SECONDS) || 60 * 60,
  },
  admin: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION,
  },
};

module.exports = env;
