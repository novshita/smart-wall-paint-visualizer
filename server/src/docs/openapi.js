/**
 * OpenAPI 3 document served at /api/docs.
 * Each feature adds a module under ./paths with its schemas and paths.
 */
const auth = require('./paths/auth');
const catalog = require('./paths/catalog');
const projects = require('./paths/projects');

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
    ...auth.paths,
    ...catalog.paths,
    ...projects.paths,
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
