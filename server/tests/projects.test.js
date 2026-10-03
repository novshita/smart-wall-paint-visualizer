const fs = require('fs');
const sharp = require('sharp');
const request = require('supertest');
const createApp = require('../src/app');
const { User, Project, ActivityLog, Setting } = require('../src/models');
const { storage } = require('../src/services/storage.service');

const app = createApp();

function image({ width = 800, height = 600, format = 'jpeg', exif, orientation } = {}) {
  let img = sharp({ create: { width, height, channels: 3, background: '#a7b49a' } });
  if (orientation) img = img.withMetadata({ orientation });
  if (exif) img = img.withExif(exif);
  return format === 'png' ? img.png().toBuffer() : img.jpeg().toBuffer();
}

async function signup(email = 'owner@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Owner', email, password: 'Paint1234' });
  return res.body.token;
}

function upload(token, buffer, { filename = 'room.jpg', confirm = 'true', title } = {}) {
  let req = request(app).post('/api/v1/projects').set('Authorization', `Bearer ${token}`);
  if (confirm !== null) req = req.field('ownershipConfirmed', confirm);
  if (title) req = req.field('title', title);
  if (buffer) req = req.attach('image', buffer, filename);
  return req;
}

function fileExists(key) {
  return fs.existsSync(storage.pathFor(key));
}

describe('projects: upload', () => {
  let token;
  beforeEach(async () => {
    token = await signup();
  });

  it('creates a project with original, working and thumbnail images', async () => {
    const res = await upload(token, await image({ width: 3000, height: 2000 }), {
      title: 'Lounge',
    });
    expect(res.status).toBe(201);

    const { project } = res.body;
    expect(project.title).toBe('Lounge');
    expect(project.status).toBe('draft');
    expect(project.originalImage).toMatchObject({
      width: 3000,
      height: 2000,
      mimeType: 'image/jpeg',
    });
    expect(project.workingImage).toMatchObject({ width: 2000, height: 1333 });
    expect(project.originalImage.url).toMatch(/^\/api\/v1\/files\/projects\/.+\?exp=\d+&sig=/);
    expect(project.thumbnailUrl).toContain('thumb.jpg');
    expect(project.variants).toHaveLength(1);
    expect(project.originalImage.storageKey).toBeUndefined();

    const stored = await Project.findById(project._id);
    expect(stored.originalImage.storageKey).not.toContain('room.jpg'); // randomised name
    for (const key of [stored.originalImage, stored.workingImage, stored.thumbnail].map(
      (i) => i.storageKey,
    )) {
      expect(fileExists(key)).toBe(true);
    }

    const log = await ActivityLog.findOne({ action: 'upload' });
    expect(log.projectId.toString()).toBe(project._id);
  });

  it('accepts PNG and keeps it as PNG', async () => {
    const res = await upload(token, await image({ format: 'png' }), { filename: 'room.png' });
    expect(res.status).toBe(201);
    expect(res.body.project.originalImage.mimeType).toBe('image/png');
  });

  it('strips EXIF metadata including GPS location', async () => {
    const withGps = await image({
      exif: {
        IFD0: { Make: 'TestCam', Copyright: 'Owner' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1' },
      },
    });
    expect((await sharp(withGps).metadata()).exif).toBeDefined();

    const res = await upload(token, withGps);
    expect(res.status).toBe(201);
    const stored = await Project.findById(res.body.project._id);
    const saved = fs.readFileSync(storage.pathFor(stored.originalImage.storageKey));
    const meta = await sharp(saved).metadata();
    expect(meta.exif).toBeUndefined();
    expect(saved.includes(Buffer.from('TestCam'))).toBe(false);
  });

  it('applies EXIF orientation so photos are the right way up', async () => {
    // Orientation 6 = rotate 90°: a 800×600 sensor image displays as 600×800
    const res = await upload(token, await image({ orientation: 6 }));
    expect(res.status).toBe(201);
    expect(res.body.project.originalImage).toMatchObject({ width: 600, height: 800 });
  });

  it('rejects a non-image renamed to .jpg (checks content, not extension)', async () => {
    const res = await upload(token, Buffer.from('<script>alert(1)</script>'.repeat(10)), {
      filename: 'evil.jpg',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Only JPG and PNG');
    expect(await Project.countDocuments()).toBe(0);
  });

  it('rejects other image formats such as GIF', async () => {
    const gif = await sharp({
      create: { width: 300, height: 300, channels: 3, background: '#000' },
    })
      .gif()
      .toBuffer();
    const res = await upload(token, gif, { filename: 'room.jpg' });
    expect(res.status).toBe(400);
  });

  it('rejects truncated/corrupt JPEGs', async () => {
    const good = await image();
    const res = await upload(token, good.subarray(0, 200));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid image|damaged/);
  });

  it('rejects images that are too small to work with', async () => {
    const res = await upload(token, await image({ width: 150, height: 150 }));
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('too small');
  });

  it('enforces the admin-configurable size limit', async () => {
    await Setting.create({ key: 'maxUploadMb', value: 0.001 }); // ~1 KB
    const res = await upload(token, await image());
    expect(res.status).toBe(413);
    expect(res.body.message).toContain('0.001 MB');
  });

  it('requires the ownership confirmation', async () => {
    const res = await upload(token, await image(), { confirm: null });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toContain('own this photo');
  });

  it('requires a file', async () => {
    const res = await upload(token, null);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Choose a photo');
  });

  it('requires login', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .attach('image', await image(), 'a.jpg');
    expect(res.status).toBe(401);
  });
});

describe('projects: access', () => {
  let owner;
  let other;
  let projectId;

  beforeEach(async () => {
    owner = await signup('owner@example.com');
    other = await signup('other@example.com');
    projectId = (await upload(owner, await image())).body.project._id;
  });

  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);

  it('lists only the current user’s projects, newest first, without regions', async () => {
    await upload(owner, await image(), { title: 'Second' });
    await upload(other, await image(), { title: 'Not mine' });

    const res = await as(owner, request(app).get('/api/v1/projects'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].title).toBe('Second');
    expect(res.body.items.map((p) => p.title)).not.toContain('Not mine');
    expect(res.body.items[0].thumbnailUrl).toBeDefined();
  });

  it('lets the owner fetch a project', async () => {
    const res = await as(owner, request(app).get(`/api/v1/projects/${projectId}`));
    expect(res.status).toBe(200);
    expect(res.body.project._id).toBe(projectId);
  });

  it("returns 404 for someone else's project (no existence leak)", async () => {
    expect((await as(other, request(app).get(`/api/v1/projects/${projectId}`))).status).toBe(404);
    expect((await as(other, request(app).delete(`/api/v1/projects/${projectId}`))).status).toBe(
      404,
    );
  });

  it('lets an admin view any project', async () => {
    await User.updateOne({ email: 'other@example.com' }, { role: 'admin' });
    expect((await as(other, request(app).get(`/api/v1/projects/${projectId}`))).status).toBe(200);
  });

  it('deletes the project and its files permanently', async () => {
    const stored = await Project.findById(projectId);
    const keys = [stored.originalImage, stored.workingImage, stored.thumbnail].map(
      (i) => i.storageKey,
    );

    const res = await as(owner, request(app).delete(`/api/v1/projects/${projectId}`));
    expect(res.status).toBe(204);
    expect(await Project.exists({ _id: projectId })).toBeNull();
    for (const key of keys) expect(fileExists(key)).toBe(false);
    expect(await ActivityLog.countDocuments({ action: 'delete' })).toBe(1);
  });
});

describe('signed file URLs', () => {
  let url;

  beforeEach(async () => {
    const token = await signup();
    url = (await upload(token, await image())).body.project.workingImage.url;
  });

  it('serves the image with a valid signature, without a login token', async () => {
    const res = await request(app).get(url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['cache-control']).toContain('private');
  });

  it('rejects tampered signatures and keys', async () => {
    expect((await request(app).get(url.replace(/sig=.{4}/, 'sig=AAAA'))).status).toBe(403);
    expect((await request(app).get(url.replace('working.jpg', 'original.jpg'))).status).toBe(403);
    expect((await request(app).get(url.split('?')[0])).status).toBe(403);
  });

  it('rejects expired links', async () => {
    const key = url.split('?')[0].replace('/api/v1/files/', '');
    const exp = Math.floor(Date.now() / 1000) - 10;
    const expired = `/api/v1/files/${key}?exp=${exp}&sig=${storage.signature(key, exp)}`;
    expect((await request(app).get(expired)).status).toBe(403);
  });

  it('blocks path traversal attempts', async () => {
    const key = '../../package.json';
    const exp = Math.floor(Date.now() / 1000) + 60;
    const res = await request(app).get(
      `/api/v1/files/${encodeURIComponent(key)}?exp=${exp}&sig=${storage.signature(key, exp)}`,
    );
    expect(res.status).toBe(403);
  });
});

describe('public settings', () => {
  it('exposes upload limits and the disclaimer, with defaults', async () => {
    const res = await request(app).get('/api/v1/settings/public');
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      maxUploadMb: 10,
      allowedFormats: ['image/jpeg', 'image/png'],
    });
    expect(res.body.settings.disclaimerText).toContain('lighting');
  });

  it('reflects admin-saved values', async () => {
    await Setting.create({ key: 'maxUploadMb', value: 5 });
    const res = await request(app).get('/api/v1/settings/public');
    expect(res.body.settings.maxUploadMb).toBe(5);
  });
});
