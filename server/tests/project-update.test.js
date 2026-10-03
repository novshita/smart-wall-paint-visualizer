const sharp = require('sharp');
const request = require('supertest');
const createApp = require('../src/app');
const { User, ActivityLog, Color } = require('../src/models');

const app = createApp();

async function signup(email) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Owner', email, password: 'Paint1234' });
  return res.body.token;
}

async function newProject(token) {
  const img = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ccc' } })
    .jpeg()
    .toBuffer();
  const res = await request(app)
    .post('/api/v1/projects')
    .set('Authorization', `Bearer ${token}`)
    .field('ownershipConfirmed', 'true')
    .attach('image', img, 'room.jpg');
  return res.body.project;
}

const wall = (overrides = {}) => ({
  regionId: 'wall-1',
  name: 'Left wall',
  selection: {
    type: 'mask',
    points: [
      [0.1, 0.1],
      [0.5, 0.1],
      [0.5, 0.8],
      [0.1, 0.8],
    ],
    strokes: [
      {
        mode: 'erase',
        size: 0.02,
        points: [
          [0.2, 0.3],
          [0.25, 0.35],
        ],
      },
    ],
    feather: 2,
  },
  style: { mode: 'solid', customHex: '#A7B49A', opacity: 90, finish: 'satin', brightness: -10 },
  ...overrides,
});

describe('PUT /projects/:id', () => {
  let token;
  let project;
  const put = (body, t = token) =>
    request(app)
      .put(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${t}`)
      .send(body);

  beforeEach(async () => {
    token = await signup('owner@example.com');
    project = await newProject(token);
  });

  it('saves walls (polygon + strokes) and styles, and returns them', async () => {
    const variantId = project.variants[0].variantId;
    const res = await put({ variants: [{ variantId, name: 'Design 1', regions: [wall()] }] });
    expect(res.status).toBe(200);
    const region = res.body.project.variants[0].regions[0];
    expect(region.selection.points).toHaveLength(4);
    expect(region.selection.strokes[0]).toMatchObject({ mode: 'erase', size: 0.02 });
    expect(region.style).toMatchObject({ customHex: '#A7B49A', opacity: 90, finish: 'satin' });

    const again = await request(app)
      .get(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(again.body.project.variants[0].regions[0].name).toBe('Left wall');
  });

  it('updates the title and marks the design saved (logging the save)', async () => {
    const res = await put({ title: 'Lounge', status: 'saved' });
    expect(res.body.project).toMatchObject({ title: 'Lounge', status: 'saved' });
    expect(await ActivityLog.countDocuments({ action: 'save' })).toBe(1);
  });

  it('rejects malformed geometry and styles', async () => {
    const variantId = project.variants[0].variantId;
    const bad = [
      wall({ selection: { type: 'polygon', points: [[0.1, 0.1]] } }), // < 3 points
      wall({
        selection: {
          type: 'polygon',
          points: [
            [5, 5],
            [0.1, 0.1],
            [0.2, 0.2],
          ],
        },
      }), // out of range
      wall({ style: { customHex: 'red' } }),
      wall({ style: { opacity: 150 } }),
      wall({ regionId: '../../etc' }),
    ];
    for (const region of bad) {
      const res = await put({ variants: [{ variantId, regions: [region] }] });
      expect(res.status).toBe(400);
    }
  });

  it('rejects duplicate region ids within a variant', async () => {
    const variantId = project.variants[0].variantId;
    const res = await put({ variants: [{ variantId, regions: [wall(), wall()] }] });
    expect(res.status).toBe(400);
  });

  it('accepts large brush-heavy designs (over the default 1 MB body limit)', async () => {
    const points = Array.from({ length: 2000 }, (_, i) => [0.123456 + i * 1e-5, 0.654321]);
    const strokes = Array.from({ length: 40 }, () => ({ mode: 'add', size: 0.01, points }));
    const variantId = project.variants[0].variantId;
    const body = {
      variants: [{ variantId, regions: [wall({ selection: { type: 'mask', strokes } })] }],
    };
    expect(JSON.stringify(body).length).toBeGreaterThan(1024 * 1024);
    const res = await put(body);
    expect(res.status).toBe(200);
  });

  it("does not let other users or admins edit someone's project", async () => {
    const other = await signup('other@example.com');
    expect((await put({ title: 'Hacked' }, other)).status).toBe(404);

    await User.updateOne({ email: 'other@example.com' }, { role: 'admin' });
    expect((await put({ title: 'Hacked' }, other)).status).toBe(404);
  });
});

describe('GET /colors?ids=', () => {
  it('returns only the requested colours', async () => {
    const [a, , c] = await Color.create([
      { code: 'A-1', name: 'A', hex: '#111111', family: 'Grey' },
      { code: 'B-1', name: 'B', hex: '#222222', family: 'Grey' },
      { code: 'C-1', name: 'C', hex: '#333333', family: 'Grey' },
    ]);
    const res = await request(app).get(`/api/v1/colors?ids=${a.id},${c.id}`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((x) => x.code).sort()).toEqual(['A-1', 'C-1']);

    expect((await request(app).get('/api/v1/colors?ids=nope')).status).toBe(400);
  });
});
