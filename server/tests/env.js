// Loaded by Mocha before any test file so config/env.js sees the test environment.
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
// Uploaded test images go to a throwaway folder, never server/uploads
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'swpv-test-uploads-'));

global.expect = require('expect').expect;
