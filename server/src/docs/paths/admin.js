const auth = [{ bearerAuth: [] }];
const err = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});
const ok = (description = 'OK', example) => ({
  description,
  ...(example ? { content: { 'application/json': { example } } } : {}),
});
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const q = (name, schema, description) => ({ name, in: 'query', schema, description });
const page = [q('page', { type: 'integer', default: 1 }), q('limit', { type: 'integer' })];
const adminOnly = { 401: err('Not logged in'), 403: err('Admins only') };
const json = (example) => ({ required: true, content: { 'application/json': { example } } });

const colorBody = json({
  code: 'BL-410',
  name: 'Harbour Blue',
  hex: '#3E5C76',
  family: 'Blue',
  brand: 'SWPV',
  finishes: ['matte', 'satin'],
  tags: ['Living Room', 'Accent'],
});

const patternForm = (required) => ({
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        required,
        properties: {
          image: {
            type: 'string',
            format: 'binary',
            description: 'PNG/JPG tile (SVG not accepted)',
          },
          name: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  },
});

module.exports = {
  paths: {
    // ---- catalogue management (spec §10.3) ----
    '/admin/colors': {
      get: {
        tags: ['Admin'],
        summary: 'List colours including deactivated ones',
        security: auth,
        parameters: [
          q('q', { type: 'string' }),
          q('family', { type: 'string' }),
          q('status', { type: 'string', enum: ['all', 'active', 'inactive'] }),
          ...page,
        ],
        responses: { 200: ok(), ...adminOnly },
      },
    },
    '/colors/import': {
      post: {
        tags: ['Admin'],
        summary: 'Bulk import colours from CSV or JSON (upserts by code)',
        description:
          'CSV header: `code,name,hex,family,brand,finishes,tags` (lists separated by `;` or `|`). JSON: an array of colour objects. Max 2000 rows.',
        security: auth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          200: ok('Import result', {
            created: 12,
            updated: 3,
            errors: [{ row: 7, message: 'HEX must look like #A7B49A' }],
          }),
          ...adminOnly,
        },
      },
    },
    '/admin/patterns': {
      get: {
        tags: ['Admin'],
        summary: 'List patterns including deactivated ones',
        security: auth,
        parameters: [q('status', { type: 'string', enum: ['all', 'active', 'inactive'] }), ...page],
        responses: { 200: ok(), ...adminOnly },
      },
    },

    // ---- users, designs, activity ----
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users with their number of projects',
        security: auth,
        parameters: [
          q('q', { type: 'string' }, 'Name or email'),
          q('role', { type: 'string', enum: ['user', 'admin'] }),
          q('status', { type: 'string', enum: ['active', 'inactive'] }),
          ...page,
        ],
        responses: { 200: ok(), ...adminOnly },
      },
    },
    '/admin/users/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Change role or activate/deactivate (not your own account)',
        security: auth,
        parameters: [idParam],
        requestBody: json({ role: 'admin', isActive: true }),
        responses: {
          200: ok(),
          400: err('Would lock yourself out'),
          404: err('Not found'),
          ...adminOnly,
        },
      },
    },
    '/admin/projects': {
      get: {
        tags: ['Admin'],
        summary: 'All saved designs (read-only), with owners',
        security: auth,
        parameters: [
          q('q', { type: 'string' }, 'Title'),
          q('userId', { type: 'string' }),
          q('status', { type: 'string', enum: ['draft', 'saved'] }),
          ...page,
        ],
        responses: { 200: ok(), ...adminOnly },
      },
    },
    '/admin/activity': {
      get: {
        tags: ['Admin'],
        summary: 'User activity log',
        security: auth,
        parameters: [
          q('action', { type: 'string' }),
          q('userId', { type: 'string' }),
          q('from', { type: 'string', format: 'date-time' }),
          q('to', { type: 'string', format: 'date-time' }),
          ...page,
        ],
        responses: { 200: ok(), ...adminOnly },
      },
    },

    // ---- settings & analytics ----
    '/admin/settings': {
      get: {
        tags: ['Admin'],
        summary: 'Read system settings',
        security: auth,
        responses: { 200: ok(), ...adminOnly },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update system settings (applies immediately)',
        security: auth,
        requestBody: json({
          maxUploadMb: 10,
          allowedFormats: ['image/jpeg', 'image/png'],
          defaultFinish: 'matte',
          disclaimerText: 'Previews are a visual guide only…',
        }),
        responses: { 200: ok(), 400: err('Invalid value'), ...adminOnly },
      },
    },
    '/admin/analytics': {
      get: {
        tags: ['Admin'],
        summary:
          'KPIs: uploads, designs saved, average session, satisfaction (+ trends, top colours)',
        security: auth,
        parameters: [
          q('days', { type: 'integer', enum: [7, 30, 90], default: 30 }),
          q('from', { type: 'string', format: 'date' }),
          q('to', { type: 'string', format: 'date' }),
        ],
        responses: { 200: ok(), ...adminOnly },
      },
    },
    '/feedback': {
      post: {
        tags: ['System'],
        summary: 'Submit a satisfaction rating (1–5) with optional comment',
        security: auth,
        requestBody: json({
          rating: 5,
          comment: 'Really helped me choose!',
          projectId: '<optional>',
        }),
        responses: { 201: ok('Recorded'), 400: err('Invalid rating') },
      },
    },
  },
  // Admin write operations added to existing catalogue paths
  catalogWrites: {
    '/colors': {
      post: {
        tags: ['Admin'],
        summary: 'Add a colour',
        security: auth,
        requestBody: colorBody,
        responses: {
          201: ok('Created'),
          400: err('Invalid'),
          409: err('Code already used'),
          ...adminOnly,
        },
      },
    },
    '/colors/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Edit a colour',
        security: auth,
        parameters: [idParam],
        requestBody: colorBody,
        responses: { 200: ok(), 404: err('Not found'), ...adminOnly },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Remove a colour (soft delete: hidden from users)',
        security: auth,
        parameters: [idParam],
        responses: { 200: ok(), 404: err('Not found'), ...adminOnly },
      },
    },
    '/patterns': {
      post: {
        tags: ['Admin'],
        summary: 'Add a pattern (tile uploaded as PNG/JPG, stored greyscale)',
        security: auth,
        requestBody: patternForm(['image', 'name', 'category']),
        responses: { 201: ok('Created'), 400: err('Invalid tile'), ...adminOnly },
      },
    },
    '/patterns/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Edit a pattern (optionally replace its tile)',
        security: auth,
        parameters: [idParam],
        requestBody: patternForm([]),
        responses: { 200: ok(), 404: err('Not found'), ...adminOnly },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Remove a pattern (soft delete)',
        security: auth,
        parameters: [idParam],
        responses: { 200: ok(), 404: err('Not found'), ...adminOnly },
      },
    },
  },
};
