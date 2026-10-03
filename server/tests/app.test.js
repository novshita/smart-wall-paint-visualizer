const request = require('supertest');
const createApp = require('../src/app');
const { Color, User } = require('../src/models');

const app = createApp();

describe('foundation', () => {
  it('GET /api/v1/health reports ok and db connected', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ status: 404, message: expect.any(String), errors: [] });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Malformed JSON body');
  });

  it('serves pattern tiles from /static', async () => {
    const res = await request(app).get('/static/patterns/stripes.svg');
    expect(res.status).toBe(200);
  });

  it('serves Swagger docs', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger');
  });
});

describe('sanitize middleware', () => {
  it('strips Mongo operators from request bodies', () => {
    const { clean } = require('../src/middleware/sanitize');
    const body = { email: { $gt: '' }, nested: { 'a.b': 1, ok: 2 } };
    expect(clean(body)).toEqual({ email: {}, nested: { ok: 2 } });
  });
});

describe('models', () => {
  it('derives rgb from hex on colours', async () => {
    const c = await Color.create({ code: 'test-1', name: 'Test', hex: '#3e8a8e', family: 'Blue' });
    expect(c.code).toBe('TEST-1');
    expect(c.hex).toBe('#3E8A8E');
    expect(c.rgb.toObject()).toEqual({ r: 62, g: 138, b: 142 });
  });

  it('never serialises passwordHash', async () => {
    const u = await User.create({ name: 'A', email: 'A@x.com', passwordHash: 'hash' });
    const json = u.toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.email).toBe('a@x.com');
    const fetched = await User.findById(u._id);
    expect(fetched.passwordHash).toBeUndefined();
  });
});
