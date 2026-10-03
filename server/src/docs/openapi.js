/**
 * OpenAPI 3 document served at /api/docs.
 * Each feature adds a module under ./paths with its schemas and paths.
 */
const auth = require('./paths/auth');
const catalog = require('./paths/catalog');
const projects = require('./paths/projects');
const admin = require('./paths/admin');

// Merge admin write operations (POST/PUT/DELETE) into the public catalogue paths
function mergePaths(...sets) {
  const out = {};
  for (const set of sets) {
    for (const [path, ops] of Object.entries(set)) out[path] = { ...out[path], ...ops };
  }
  return out;
}

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Wall Paint Visualizer API',
    version: '1.0.0',
    description:
      'REST API for uploading room photos, selecting walls, and previewing paint colours and patterns.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ...auth.schemas,
      ...catalog.schemas,
      ...projects.schemas,
      Error: {
        type: 'object',
        properties: {
          status: { type: 'integer', example: 400 },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: { field: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  paths: {
    ...mergePaths(auth.paths, catalog.paths, admin.catalogWrites, projects.paths, admin.paths),
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Service is up',
            content: {
              'application/json': {
                example: { status: 'ok', db: 'connected', uptime: 42 },
              },
            },
          },
        },
      },
    },
  },
};
