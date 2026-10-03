const fs = require('fs');
const sharp = require('sharp');
const request = require('supertest');
const createApp = require('../src/app');
const { Project, ActivityLog } = require('../src/models');
const { storage } = require('../src/services/storage.service');

const app = createApp();

const jpeg = (w = 800, h = 600, color = '#cccccc') =>
  sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .jpeg()
    .toBuffer();

async function signup(email) {
  return (
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Owner', email, password: 'Paint1234' })
  ).body.token;
}

async function newProject(token) {
  const res = await request(app)
    .post('/api/v1/projects')
    .set('Authorization', `Bearer ${token}`)
    .field('ownershipConfirmed', 'true')
    .attach('image', await jpeg(), 'room.jpg');
  return res.body.project;
}

const exists = (key) => fs.existsSync(storage.pathFor(key));

describe('project renders, duplicates and activity', () => {
  let token;
  let project;
  const auth = (req, t = token) => req.set('Authorization', `Bearer ${t}`);
  const uploadRender = (variantId, buf, t) =>
    auth(request(app).post(`/api/v1/projects/${project._id}/render`), t)
      .field('variantId', variantId)
      .attach('image', buf, 'render.jpg');

  beforeEach(async () => {
    token = await signup('owner@example.com');
    project = await newProject(token);
  });

  it('stores a small render per variant and replaces the old one', async () => {
    const variantId = project.variants[0].variantId;
    const first = await uploadRender(variantId, await jpeg(2000, 1500, '#a7b49a'));
    expect(first.status).toBe(200);
    expect(first.body.project.variants[0].renderUrl).toMatch(/render-.+\.jpg\?exp=/);

    const stored = await Project.findById(project._id);
    const firstKey = stored.variants[0].renderKey;
    const meta = await sharp(fs.readFileSync(storage.pathFor(firstKey))).metadata();
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(960);

    await uploadRender(variantId, await jpeg(800, 600, '#4f6d8a')).expect(200);
    const after = await Project.findById(project._id);
    expect(after.variants[0].renderKey).not.toBe(firstKey);
    expect(exists(firstKey)).toBe(false);
  });

  it('rejects renders for unknown variants or non-images', async () => {
    expect((await uploadRender('nope', await jpeg())).status).toBe(404);
    expect(
      (await uploadRender(project.variants[0].variantId, Buffer.from('not an image!!'))).status,
    ).toBe(400);
  });

  it('keeps renders when saving designs, and deletes renders of removed variants', async () => {
    const v1 = project.variants[0].variantId;
    await uploadRender(v1, await jpeg()).expect(200);
    const key = (await Project.findById(project._id)).variants[0].renderKey;

    // Saving the same variant (client sends renderUrl back; it's ignored) keeps the render
    await auth(request(app).put(`/api/v1/projects/${project._id}`))
      .send({ variants: [{ variantId: v1, name: 'Design 1', regions: [], renderUrl: 'x' }] })
      .expect(200);
    expect((await Project.findById(project._id)).variants[0].renderKey).toBe(key);

    // Replacing it with a different variant removes the old render file
    await auth(request(app).put(`/api/v1/projects/${project._id}`))
      .send({ variants: [{ variantId: 'v-new', name: 'Design 2', regions: [] }] })
      .expect(200);
    expect(exists(key)).toBe(false);
  });

  it('saves dual-tone styles with a custom second colour', async () => {
    const res = await auth(request(app).put(`/api/v1/projects/${project._id}`)).send({
      variants: [
        {
          variantId: project.variants[0].variantId,
          regions: [
            {
              regionId: 'w1',
              name: 'Wall',
              selection: {
                type: 'polygon',
                points: [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                ],
              },
              style: {
                mode: 'dual',
                customHex: '#FFFFFF',
                secondaryCustomHex: '#22344A',
                split: { direction: 'horizontal', position: 40 },
              },
            },
          ],
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.project.variants[0].regions[0].style).toMatchObject({
      mode: 'dual',
      secondaryCustomHex: '#22344A',
      split: { direction: 'horizontal', position: 40 },
    });
  });

  it('duplicates a project with its own copies of every file', async () => {
    await uploadRender(project.variants[0].variantId, await jpeg()).expect(200);
    const res = await auth(request(app).post(`/api/v1/projects/${project._id}/duplicate`));
    expect(res.status).toBe(201);
    expect(res.body.project.title).toBe('Copy of My room');
    expect(res.body.project.status).toBe('draft');
    expect(res.body.project.variants[0].renderUrl).toBeDefined();

    const original = await Project.findById(project._id);
    const copy = await Project.findById(res.body.project._id);
    expect(copy.originalImage.storageKey).not.toBe(original.originalImage.storageKey);
    expect(exists(copy.originalImage.storageKey)).toBe(true);

    // Deleting the original must not break the copy
    await auth(request(app).delete(`/api/v1/projects/${project._id}`)).expect(204);
    expect(exists(copy.originalImage.storageKey)).toBe(true);
    expect(exists(copy.variants[0].renderKey)).toBe(true);
  });

  it("does not let others duplicate or render someone's project", async () => {
    const other = await signup('other@example.com');
    expect(
      (await auth(request(app).post(`/api/v1/projects/${project._id}/duplicate`), other)).status,
    ).toBe(404);
    expect((await uploadRender(project.variants[0].variantId, await jpeg(), other)).status).toBe(
      404,
    );
  });

  it('logs client activity such as downloads, only for own projects', async () => {
    await auth(request(app).post('/api/v1/activity'))
      .send({
        action: 'download',
        projectId: project._id,
        metadata: { format: 'png', layout: 'painted' },
      })
      .expect(204);
    const log = await ActivityLog.findOne({ action: 'download' });
    expect(log.metadata).toEqual({ format: 'png', layout: 'painted' });

    expect(
      (await auth(request(app).post('/api/v1/activity')).send({ action: 'login' })).status,
    ).toBe(400);
    const other = await signup('other@example.com');
    expect(
      (
        await auth(request(app).post('/api/v1/activity'), other).send({
          action: 'download',
          projectId: project._id,
        })
      ).status,
    ).toBe(404);
  });

  it('serves pattern tiles with CORS so they can be drawn on a canvas', async () => {
    const res = await request(app).get('/static/patterns/chevron.svg');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
