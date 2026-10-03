const request = require('supertest');
const createApp = require('../src/app');
const { Color, Pattern } = require('../src/models');

const app = createApp();

const seedColors = [
  {
    code: 'BL-1',
    name: 'Coastal Breeze',
    hex: '#A9C6D8',
    family: 'Blue',
    tags: ['Bedroom'],
    brand: 'SWPV',
  },
  {
    code: 'BL-2',
    name: 'Denim Dusk',
    hex: '#4F6D8A',
    family: 'Blue',
    tags: ['Accent'],
    brand: 'Acme',
    finishes: ['matte'],
  },
  {
    code: 'GN-1',
    name: 'Sage Garden',
    hex: '#A7B49A',
    family: 'Green',
    tags: ['Kitchen'],
    brand: 'SWPV',
  },
  {
    code: 'WH-1',
    name: 'Morning Linen',
    hex: '#F4F1EA',
    family: 'White',
    tags: ['Bedroom'],
    brand: 'SWPV',
  },
  { code: 'XX-1', name: 'Hidden Shade', hex: '#123456', family: 'Blue', isActive: false },
];

async function registerToken() {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Fav User', email: 'fav@example.com', password: 'Paint1234' });
  return res.body.token;
}

describe('colours', () => {
  beforeEach(() => Color.create(seedColors));

  it('lists active colours only, grouped by family order (White first)', async () => {
    const res = await request(app).get('/api/v1/colors');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items.map((c) => c.code)).toEqual(['WH-1', 'BL-1', 'BL-2', 'GN-1']);
    expect(res.body).toMatchObject({ page: 1, limit: 24, pages: 1 });
  });

  it('filters by family, brand, finish and tag', async () => {
    const byFamily = await request(app).get('/api/v1/colors?family=Blue');
    expect(byFamily.body.items.map((c) => c.code)).toEqual(['BL-1', 'BL-2']);

    const byBrand = await request(app).get('/api/v1/colors?brand=Acme');
    expect(byBrand.body.items.map((c) => c.code)).toEqual(['BL-2']);

    const byFinish = await request(app).get('/api/v1/colors?finish=glossy');
    expect(byFinish.body.items.map((c) => c.code)).not.toContain('BL-2');

    const byTag = await request(app).get('/api/v1/colors?tag=Bedroom');
    expect(byTag.body.items.map((c) => c.code).sort()).toEqual(['BL-1', 'WH-1']);
  });

  it('searches by partial name, code, and HEX', async () => {
    const byName = await request(app).get('/api/v1/colors?q=sage');
    expect(byName.body.items.map((c) => c.code)).toEqual(['GN-1']);

    const byCode = await request(app).get('/api/v1/colors?q=bl-');
    expect(byCode.body.total).toBe(2);

    const byHex = await request(app).get(`/api/v1/colors?q=${encodeURIComponent('#a9c6')}`);
    expect(byHex.body.items.map((c) => c.code)).toEqual(['BL-1']);
  });

  it('treats regex characters in search literally', async () => {
    const res = await request(app).get(`/api/v1/colors?q=${encodeURIComponent('.*(')}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('paginates', async () => {
    const res = await request(app).get('/api/v1/colors?limit=3&page=2');
    expect(res.body).toMatchObject({ total: 4, page: 2, pages: 2 });
    expect(res.body.items).toHaveLength(1);
  });

  it('rejects invalid query params', async () => {
    const res = await request(app).get('/api/v1/colors?limit=1000&finish=shiny');
    expect(res.status).toBe(400);
  });

  it('returns facets with counts in family order', async () => {
    const res = await request(app).get('/api/v1/colors/facets');
    expect(res.status).toBe(200);
    expect(res.body.families.map((f) => f.value)).toEqual(['White', 'Blue', 'Green']);
    expect(res.body.families.find((f) => f.value === 'Blue').count).toBe(2);
    expect(res.body.brands.map((b) => b.value)).toEqual(['Acme', 'SWPV']);
    expect(res.body.finishes.map((f) => f.value)).toEqual(['matte', 'satin', 'glossy']);
  });

  it('gets a colour by id, 404s for inactive or unknown, 400s for bad ids', async () => {
    const sage = await Color.findOne({ code: 'GN-1' });
    const ok = await request(app).get(`/api/v1/colors/${sage.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.color).toMatchObject({ name: 'Sage Garden', rgb: { r: 167, g: 180, b: 154 } });

    const hidden = await Color.findOne({ code: 'XX-1' });
    expect((await request(app).get(`/api/v1/colors/${hidden.id}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/colors/not-an-id')).status).toBe(400);
  });
});

describe('patterns', () => {
  beforeEach(() =>
    Pattern.create([
      { name: 'Chevron', category: 'Geometric', imageUrl: '/static/patterns/chevron.svg' },
      { name: 'Leaves', category: 'Floral', imageUrl: '/static/patterns/leaf.svg' },
      { name: 'Old', category: 'Floral', imageUrl: '/x.svg', isActive: false },
    ]),
  );

  it('lists active patterns with categories and filters by category', async () => {
    const all = await request(app).get('/api/v1/patterns');
    expect(all.body.total).toBe(2);
    expect(all.body.categories).toEqual(['Floral', 'Geometric']);

    const floral = await request(app).get('/api/v1/patterns?category=Floral');
    expect(floral.body.items.map((p) => p.name)).toEqual(['Leaves']);
  });
});

describe('favourites', () => {
  let token;
  let sage;
  let blue;

  beforeEach(async () => {
    await Color.create(seedColors);
    sage = await Color.findOne({ code: 'GN-1' });
    blue = await Color.findOne({ code: 'BL-1' });
    token = await registerToken();
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  it('requires login', async () => {
    expect((await request(app).get('/api/v1/me/favorites')).status).toBe(401);
    expect((await request(app).post(`/api/v1/me/favorites/colors/${sage.id}`)).status).toBe(401);
  });

  it('adds idempotently, lists populated colours, and removes', async () => {
    await auth(request(app).post(`/api/v1/me/favorites/colors/${sage.id}`)).expect(200);
    const twice = await auth(request(app).post(`/api/v1/me/favorites/colors/${sage.id}`));
    expect(twice.body.ids).toEqual([sage.id]);
    await auth(request(app).post(`/api/v1/me/favorites/colors/${blue.id}`)).expect(200);

    const list = await auth(request(app).get('/api/v1/me/favorites'));
    expect(list.body.colors.map((c) => c.name)).toEqual(['Sage Garden', 'Coastal Breeze']);
    expect(list.body.patterns).toEqual([]);

    const removed = await auth(request(app).delete(`/api/v1/me/favorites/colors/${sage.id}`));
    expect(removed.body.ids).toEqual([blue.id]);
  });

  it('404s when favouriting an unknown or inactive colour', async () => {
    const hidden = await Color.findOne({ code: 'XX-1' });
    expect((await auth(request(app).post(`/api/v1/me/favorites/colors/${hidden.id}`))).status).toBe(
      404,
    );
  });

  it('hides favourites that an admin has since deactivated', async () => {
    await auth(request(app).post(`/api/v1/me/favorites/colors/${sage.id}`)).expect(200);
    await Color.updateOne({ _id: sage._id }, { isActive: false });
    const list = await auth(request(app).get('/api/v1/me/favorites'));
    expect(list.body.colors).toEqual([]);
  });

  it('supports favourite patterns', async () => {
    const p = await Pattern.create({ name: 'Grid', category: 'Geometric', imageUrl: '/g.svg' });
    await auth(request(app).post(`/api/v1/me/favorites/patterns/${p.id}`)).expect(200);
    const list = await auth(request(app).get('/api/v1/me/favorites'));
    expect(list.body.patterns.map((x) => x.name)).toEqual(['Grid']);
  });
});
