const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const request = require('supertest');
const createApp = require('../src/app');
const { User, Color, Pattern, ActivityLog, Feedback, Project } = require('../src/models');
const { parseCsv } = require('../src/services/color-import.service');

const app = createApp();

async function account(email, role = 'user') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: email.split('@')[0], email, password: 'Paint1234' });
  if (role === 'admin') {
    await User.updateOne({ email }, { role: 'admin' });
    // role is read from the database on each request, so the same token now has admin rights
  }
  return { token: res.body.token, id: res.body.user._id };
}

describe('admin', () => {
  let admin;
  let user;
  const as = (who, req) => req.set('Authorization', `Bearer ${who.token}`);

  beforeEach(async () => {
    admin = await account('admin@example.com', 'admin');
    user = await account('user@example.com');
  });

  it('blocks non-admins from every admin route', async () => {
    for (const [method, url] of [
      ['get', '/api/v1/admin/users'],
      ['get', '/api/v1/admin/analytics'],
      ['put', '/api/v1/admin/settings'],
      ['post', '/api/v1/colors'],
      ['post', '/api/v1/colors/import'],
      ['delete', '/api/v1/patterns/aaaaaaaaaaaaaaaaaaaaaaaa'],
    ]) {
      expect((await as(user, request(app)[method](url))).status).toBe(403);
      expect((await request(app)[method](url)).status).toBe(401);
    }
  });

  describe('colours', () => {
    it('creates, edits and soft-deletes colours; changes show in the public library immediately', async () => {
      const created = await as(admin, request(app).post('/api/v1/colors')).send({
        code: 'tq-1',
        name: 'Teal Quartz',
        hex: '3e8a8e',
        family: 'Blue',
        tags: ['Accent'],
      });
      expect(created.status).toBe(201);
      expect(created.body.color).toMatchObject({
        code: 'TQ-1',
        hex: '#3E8A8E',
        rgb: { r: 62, g: 138, b: 142 },
      });
      const id = created.body.color._id;

      expect((await request(app).get('/api/v1/colors?q=quartz')).body.total).toBe(1);

      const edited = await as(admin, request(app).put(`/api/v1/colors/${id}`)).send({
        hex: '#000000',
      });
      expect(edited.body.color.rgb).toEqual({ r: 0, g: 0, b: 0 });

      await as(admin, request(app).delete(`/api/v1/colors/${id}`)).expect(200);
      expect((await request(app).get('/api/v1/colors?q=quartz')).body.total).toBe(0);
      const adminList = await as(admin, request(app).get('/api/v1/admin/colors?status=inactive'));
      expect(adminList.body.items.map((c) => c.code)).toEqual(['TQ-1']);
    });

    it('rejects duplicates and bad values', async () => {
      await Color.create({ code: 'A-1', name: 'A', hex: '#111111', family: 'Grey' });
      expect(
        (
          await as(admin, request(app).post('/api/v1/colors')).send({
            code: 'a-1',
            name: 'B',
            hex: '#222222',
            family: 'Grey',
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await as(admin, request(app).post('/api/v1/colors')).send({
            code: 'B-1',
            name: 'B',
            hex: 'blue',
            family: 'Grey',
          })
        ).status,
      ).toBe(400);
    });

    it('imports CSV, upserting by code and reporting row errors', async () => {
      await Color.create({ code: 'OLD-1', name: 'Old', hex: '#111111', family: 'Grey' });
      const csv = [
        'code,name,hex,family,brand,finishes,tags',
        'OLD-1,Old renamed,#222222,Grey,SWPV,matte;satin,Office',
        'NEW-1,"Fresh, bright",#FFFFFF,White,SWPV,,Kitchen|Bathroom',
        'BAD-1,Broken,not-a-hex,Grey,,,',
        'NEW-1,Duplicate,#000000,Grey,,,',
      ].join('\n');
      const res = await as(admin, request(app).post('/api/v1/colors/import')).attach(
        'file',
        Buffer.from(csv),
        'colours.csv',
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ created: 1, updated: 1 });
      expect(res.body.errors.map((e) => e.row)).toEqual([4, 5]);

      const fresh = await Color.findOne({ code: 'NEW-1' });
      expect(fresh.name).toBe('Fresh, bright');
      expect(fresh.tags).toEqual(['Kitchen', 'Bathroom']);
      expect((await Color.findOne({ code: 'OLD-1' })).finishes).toEqual(['matte', 'satin']);
    });

    it('imports a JSON file', async () => {
      const json = JSON.stringify([{ code: 'J-1', name: 'Json', hex: '#123456', family: 'Blue' }]);
      const res = await as(admin, request(app).post('/api/v1/colors/import')).attach(
        'file',
        Buffer.from(json),
        'colours.json',
      );
      expect(res.body).toMatchObject({ created: 1, updated: 0, errors: [] });
    });

    it('parses quoted CSV fields', () => {
      expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\n')).toEqual([
        ['a', 'b'],
        ['x, y', 'he said "hi"'],
      ]);
    });
  });

  describe('patterns', () => {
    it('uploads a tile as greyscale PNG, edits and deactivates it', async () => {
      const tile = await sharp({
        create: { width: 64, height: 64, channels: 3, background: '#ff0000' },
      })
        .png()
        .toBuffer();
      const res = await as(admin, request(app).post('/api/v1/patterns'))
        .field('name', 'Red squares')
        .field('category', 'Geometric')
        .attach('image', tile, 'tile.png');
      expect(res.status).toBe(201);
      const { imageUrl, _id } = res.body.pattern;
      expect(imageUrl).toMatch(/^\/static\/patterns\/custom\/.+\.png$/);

      const file = path.join(__dirname, '../public', imageUrl.replace('/static/', ''));
      const meta = await sharp(fs.readFileSync(file)).metadata();
      expect(meta.channels).toBeLessThanOrEqual(2); // greyscale
      expect((await request(app).get(imageUrl)).status).toBe(200);

      await as(admin, request(app).put(`/api/v1/patterns/${_id}`))
        .field('name', 'Squares')
        .expect(200);
      await as(admin, request(app).delete(`/api/v1/patterns/${_id}`)).expect(200);
      expect(
        (await request(app).get('/api/v1/patterns')).body.items.map((p) => p.name),
      ).not.toContain('Squares');

      fs.rmSync(file, { force: true });
    });

    it('rejects SVG tiles', async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      );
      const res = await as(admin, request(app).post('/api/v1/patterns'))
        .field('name', 'Evil')
        .field('category', 'X')
        .attach('image', svg, 'tile.svg');
      expect(res.status).toBe(400);
      expect(await Pattern.countDocuments()).toBe(0);
    });
  });

  describe('users', () => {
    it('lists users with project counts and never exposes password hashes', async () => {
      const res = await as(admin, request(app).get('/api/v1/admin/users?q=user'));
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({ email: 'user@example.com', projectCount: 0 });
      expect(res.body.items[0].passwordHash).toBeUndefined();
    });

    it('deactivates users (their session stops working) and changes roles', async () => {
      await as(admin, request(app).patch(`/api/v1/admin/users/${user.id}`))
        .send({ isActive: false })
        .expect(200);
      expect((await as(user, request(app).get('/api/v1/auth/me'))).status).toBe(401);

      await as(admin, request(app).patch(`/api/v1/admin/users/${user.id}`))
        .send({ isActive: true, role: 'admin' })
        .expect(200);
      expect((await as(user, request(app).get('/api/v1/admin/users'))).status).toBe(200);
    });

    it('stops admins locking themselves out', async () => {
      const res = await as(admin, request(app).patch(`/api/v1/admin/users/${admin.id}`)).send({
        isActive: false,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('settings', () => {
    it('updates settings that apply immediately to the public settings', async () => {
      const res = await as(admin, request(app).put('/api/v1/admin/settings')).send({
        maxUploadMb: 5,
        disclaimerText: 'Colours are approximate; always test a sample pot.',
      });
      expect(res.body.settings.maxUploadMb).toBe(5);
      const pub = await request(app).get('/api/v1/settings/public');
      expect(pub.body.settings.disclaimerText).toContain('sample pot');
      expect(
        (await as(admin, request(app).put('/api/v1/admin/settings')).send({ maxUploadMb: 500 }))
          .status,
      ).toBe(400);
    });
  });

  describe('feedback & analytics', () => {
    it('records feedback and reports all four KPIs with daily series and top colours', async () => {
      const sage = await Color.create({
        code: 'GN-1',
        name: 'Sage',
        hex: '#A7B49A',
        family: 'Green',
      });
      const project = await Project.create({
        userId: user.id,
        title: 'Room',
        status: 'saved',
        originalImage: { storageKey: 'projects/x/original.jpg', width: 10, height: 10 },
        workingImage: { storageKey: 'projects/x/working.jpg', width: 10, height: 10 },
        thumbnail: { storageKey: 'projects/x/thumb.jpg', width: 10, height: 10 },
        variants: [
          {
            variantId: 'v1',
            regions: [
              { regionId: 'w', selection: { type: 'polygon' }, style: { colorId: sage._id } },
            ],
          },
        ],
      });
      await ActivityLog.create([
        { userId: user.id, action: 'upload', projectId: project._id },
        { userId: user.id, action: 'upload', projectId: project._id },
        { userId: user.id, action: 'save', projectId: project._id },
        { userId: user.id, action: 'save', projectId: project._id },
        { userId: user.id, action: 'session_end', metadata: { durationSeconds: 300 } },
        { userId: user.id, action: 'session_end', metadata: { durationSeconds: 100 } },
      ]);
      await as(user, request(app).post('/api/v1/feedback'))
        .send({ rating: 5, comment: 'Great' })
        .expect(201);
      await as(user, request(app).post('/api/v1/feedback')).send({ rating: 4 }).expect(201);
      expect(
        (await as(user, request(app).post('/api/v1/feedback')).send({ rating: 9 })).status,
      ).toBe(400);

      const res = await as(admin, request(app).get('/api/v1/admin/analytics?days=7'));
      expect(res.status).toBe(200);
      expect(res.body.kpis).toMatchObject({
        uploads: 2,
        designsSaved: 1,
        totalSavedDesigns: 1,
        avgSessionSeconds: 200,
        sessions: 2,
        satisfaction: { average: 4.5, responses: 2 },
        totalUsers: 2,
      });
      expect(res.body.kpis.satisfaction.distribution.find((d) => d.rating === 5).count).toBe(1);
      expect(res.body.series).toHaveLength(7);
      expect(res.body.series.at(-1)).toMatchObject({ uploads: 2, saves: 2 });
      expect(res.body.topColors[0]).toMatchObject({ uses: 1, color: { name: 'Sage' } });
      expect(await Feedback.countDocuments()).toBe(2);
    });
  });

  describe('designs and activity (read-only)', () => {
    it('lists all users’ designs with owners, and the activity log with filters', async () => {
      const img = await sharp({
        create: { width: 400, height: 300, channels: 3, background: '#ccc' },
      })
        .jpeg()
        .toBuffer();
      await as(user, request(app).post('/api/v1/projects'))
        .field('ownershipConfirmed', 'true')
        .attach('image', img, 'room.jpg')
        .expect(201);

      const projects = await as(admin, request(app).get('/api/v1/admin/projects'));
      expect(projects.body.items[0].owner).toMatchObject({ email: 'user@example.com' });
      expect(projects.body.items[0].thumbnailUrl).toBeDefined();

      const activity = await as(admin, request(app).get('/api/v1/admin/activity?action=upload'));
      expect(activity.body.total).toBe(1);
      expect(activity.body.items[0].userId.email).toBe('user@example.com');
    });
  });
});
