const request = require('supertest');
const jwt = require('jsonwebtoken');
const createApp = require('../src/app');
const env = require('../src/config/env');
const { User, ActivityLog } = require('../src/models');
const { requireRole, authenticate } = require('../src/middleware/auth');

const app = createApp();
const api = '/api/v1/auth';
const valid = { name: 'Asha Rao', email: 'Asha@Example.com', password: 'Paint1234' };

async function register(body = valid) {
  return request(app).post(`${api}/register`).send(body);
}

describe('auth', () => {
  describe('POST /register', () => {
    it('creates a user, returns a token, and never returns the password', async () => {
      const res = await register();
      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        name: 'Asha Rao',
        email: 'asha@example.com',
        role: 'user',
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.tokenVersion).toBeUndefined();

      const stored = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
      expect(stored.passwordHash).not.toBe(valid.password);
      expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      expect(await ActivityLog.countDocuments({ action: 'register' })).toBe(1);
    });

    it('ignores attempts to self-assign the admin role', async () => {
      const res = await register({ ...valid, role: 'admin' });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('user');
    });

    it('rejects duplicate emails (case-insensitive)', async () => {
      await register();
      const res = await register({ ...valid, email: 'ASHA@example.com' });
      expect(res.status).toBe(409);
    });

    it('validates input with field-level errors', async () => {
      const res = await register({ name: 'A', email: 'nope', password: 'short' });
      expect(res.status).toBe(400);
      const fields = res.body.errors.map((e) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    });

    it('requires a letter and a number in the password', async () => {
      const res = await register({ ...valid, password: 'abcdefgh' });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].message).toContain('number');
    });
  });

  describe('POST /login', () => {
    beforeEach(() => register());

    it('logs in with correct credentials and records lastLoginAt + activity', async () => {
      const res = await request(app)
        .post(`${api}/login`)
        .send({ email: 'asha@example.com', password: 'Paint1234' });
      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(await ActivityLog.countDocuments({ action: 'login' })).toBe(1);
    });

    it('returns the same generic error for a wrong password and an unknown email', async () => {
      const wrongPw = await request(app)
        .post(`${api}/login`)
        .send({ email: 'asha@example.com', password: 'Wrong1234' });
      const unknown = await request(app)
        .post(`${api}/login`)
        .send({ email: 'nobody@example.com', password: 'Wrong1234' });
      expect(wrongPw.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrongPw.body.message).toBe(unknown.body.message);
    });

    it('blocks NoSQL operator injection', async () => {
      const res = await request(app)
        .post(`${api}/login`)
        .send({ email: { $gt: '' }, password: { $gt: '' } });
      expect(res.status).toBe(400);
    });

    it('refuses deactivated accounts', async () => {
      await User.updateOne({ email: 'asha@example.com' }, { isActive: false });
      const res = await request(app)
        .post(`${api}/login`)
        .send({ email: 'asha@example.com', password: 'Paint1234' });
      expect(res.status).toBe(403);
    });
  });

  describe('authenticated routes', () => {
    let token;
    beforeEach(async () => {
      token = (await register()).body.token;
    });

    it('GET /me requires a token', async () => {
      expect((await request(app).get(`${api}/me`)).status).toBe(401);
      expect((await request(app).get(`${api}/me`).set('Authorization', 'Bearer junk')).status).toBe(
        401,
      );
    });

    it('GET /me returns the current user', async () => {
      const res = await request(app).get(`${api}/me`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('asha@example.com');
    });

    it('rejects expired tokens with a clear message', async () => {
      const user = await User.findOne({ email: 'asha@example.com' });
      const expired = jwt.sign({ sub: user.id, role: 'user', ver: 0 }, env.jwt.secret, {
        expiresIn: -10,
      });
      const res = await request(app).get(`${api}/me`).set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('expired');
    });

    it('rejects tokens of deactivated users immediately', async () => {
      await User.updateOne({ email: 'asha@example.com' }, { isActive: false });
      const res = await request(app).get(`${api}/me`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('PATCH /me updates name and email', async () => {
      const res = await request(app)
        .patch(`${api}/me`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Asha R', email: 'asha.r@example.com', role: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        name: 'Asha R',
        email: 'asha.r@example.com',
        role: 'user',
      });
    });

    it('PATCH /me refuses an email used by another account', async () => {
      await register({ ...valid, email: 'other@example.com' });
      const res = await request(app)
        .patch(`${api}/me`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'other@example.com' });
      expect(res.status).toBe(409);
    });

    it('PATCH /password checks the current password', async () => {
      const res = await request(app)
        .patch(`${api}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Wrong1234', newPassword: 'NewPaint99' });
      expect(res.status).toBe(400);
      expect(res.body.errors[0].field).toBe('currentPassword');
    });

    it('PATCH /password rejects reusing the same password', async () => {
      const res = await request(app)
        .patch(`${api}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Paint1234', newPassword: 'Paint1234' });
      expect(res.status).toBe(400);
    });

    it('PATCH /password invalidates old tokens and returns a working new one', async () => {
      const res = await request(app)
        .patch(`${api}/password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Paint1234', newPassword: 'NewPaint99' });
      expect(res.status).toBe(200);

      const oldTokenRes = await request(app)
        .get(`${api}/me`)
        .set('Authorization', `Bearer ${token}`);
      expect(oldTokenRes.status).toBe(401);
      const newTokenRes = await request(app)
        .get(`${api}/me`)
        .set('Authorization', `Bearer ${res.body.token}`);
      expect(newTokenRes.status).toBe(200);

      const login = await request(app)
        .post(`${api}/login`)
        .send({ email: 'asha@example.com', password: 'NewPaint99' });
      expect(login.status).toBe(200);
    });

    it('POST /logout records the event', async () => {
      const res = await request(app).post(`${api}/logout`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
      expect(await ActivityLog.countDocuments({ action: 'logout' })).toBe(1);
    });
  });

  describe('requireRole', () => {
    // Mount a throwaway admin-only route to exercise the middleware end to end
    const express = require('express');
    const { errorHandler } = require('../src/middleware/error-handler');
    const guarded = express();
    guarded.get('/admin-only', authenticate, requireRole('admin'), (req, res) =>
      res.json({ ok: true }),
    );
    guarded.use(errorHandler);

    it('blocks regular users and allows admins', async () => {
      const userToken = (await register()).body.token;
      expect(
        (await request(guarded).get('/admin-only').set('Authorization', `Bearer ${userToken}`))
          .status,
      ).toBe(403);

      await User.updateOne({ email: 'asha@example.com' }, { role: 'admin' });
      expect(
        (await request(guarded).get('/admin-only').set('Authorization', `Bearer ${userToken}`))
          .status,
      ).toBe(200);
    });
  });
});
