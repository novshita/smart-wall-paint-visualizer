const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const json = (schema, description = 'OK') => ({
  description,
  content: { 'application/json': { schema } },
});

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const query = (name, schema, description) => ({ name, in: 'query', schema, description });
const pageParams = [
  query('page', { type: 'integer', minimum: 1, default: 1 }),
  query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 24 }),
];

const page = (itemSchema, extra = {}) => ({
  type: 'object',
  properties: {
    items: { type: 'array', items: itemSchema },
    total: { type: 'integer' },
    page: { type: 'integer' },
    limit: { type: 'integer' },
    pages: { type: 'integer' },
    ...extra,
  },
});

const facet = {
  type: 'array',
  items: {
    type: 'object',
    properties: { value: { type: 'string' }, count: { type: 'integer' } },
  },
};

const favoriteIds = json({
  type: 'object',
  properties: { ids: { type: 'array', items: { type: 'string' } } },
});

module.exports = {
  schemas: {
    Color: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        code: { type: 'string', example: 'GN-501' },
        name: { type: 'string', example: 'Sage Garden' },
        hex: { type: 'string', example: '#A7B49A' },
        rgb: {
          type: 'object',
          properties: { r: { type: 'integer' }, g: { type: 'integer' }, b: { type: 'integer' } },
        },
        brand: { type: 'string', example: 'SWPV' },
        family: { type: 'string', example: 'Green' },
        finishes: { type: 'array', items: { type: 'string', enum: ['matte', 'satin', 'glossy'] } },
        tags: { type: 'array', items: { type: 'string' }, example: ['Living Room', 'Kitchen'] },
        swatchUrl: { type: 'string' },
        isActive: { type: 'boolean' },
      },
    },
    Pattern: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        name: { type: 'string', example: 'Chevron Zigzag' },
        description: { type: 'string' },
        category: { type: 'string', example: 'Geometric' },
        imageUrl: { type: 'string', example: '/static/patterns/chevron.svg' },
        tileSize: {
          type: 'object',
          properties: { width: { type: 'integer' }, height: { type: 'integer' } },
        },
        isActive: { type: 'boolean' },
      },
    },
  },
  paths: {
    '/colors': {
      get: {
        tags: ['Colours'],
        summary: 'List, search and filter colours',
        parameters: [
          query('q', { type: 'string' }, 'Search name or code; "#A7B" searches by HEX'),
          query('family', { type: 'string' }, 'e.g. Blue, Neutral'),
          query('brand', { type: 'string' }),
          query('finish', { type: 'string', enum: ['matte', 'satin', 'glossy'] }),
          query('tag', { type: 'string' }, 'e.g. Bedroom, Accent'),
          query('sort', { type: 'string', enum: ['family', 'name', 'code'], default: 'family' }),
          ...pageParams,
        ],
        responses: { 200: json(page(ref('Color'))), 400: errorResponse('Invalid query') },
      },
    },
    '/colors/facets': {
      get: {
        tags: ['Colours'],
        summary: 'Filter options with counts (families, brands, tags, finishes)',
        responses: {
          200: json({
            type: 'object',
            properties: { families: facet, brands: facet, tags: facet, finishes: facet },
          }),
        },
      },
    },
    '/colors/{id}': {
      get: {
        tags: ['Colours'],
        summary: 'Colour detail',
        parameters: [idParam],
        responses: {
          200: json({ type: 'object', properties: { color: ref('Color') } }),
          404: errorResponse('Not found'),
        },
      },
    },
    '/patterns': {
      get: {
        tags: ['Patterns'],
        summary: 'List and filter patterns',
        parameters: [
          query('q', { type: 'string' }),
          query('category', { type: 'string' }),
          ...pageParams,
        ],
        responses: {
          200: json(
            page(ref('Pattern'), { categories: { type: 'array', items: { type: 'string' } } }),
          ),
        },
      },
    },
    '/patterns/{id}': {
      get: {
        tags: ['Patterns'],
        summary: 'Pattern detail',
        parameters: [idParam],
        responses: {
          200: json({ type: 'object', properties: { pattern: ref('Pattern') } }),
          404: errorResponse('Not found'),
        },
      },
    },
    '/me/favorites': {
      get: {
        tags: ['Favourites'],
        summary: "Current user's favourite colours and patterns",
        security: [{ bearerAuth: [] }],
        responses: {
          200: json({
            type: 'object',
            properties: {
              colors: { type: 'array', items: ref('Color') },
              patterns: { type: 'array', items: ref('Pattern') },
            },
          }),
          401: errorResponse('Not logged in'),
        },
      },
    },
    '/me/favorites/colors/{id}': {
      post: {
        tags: ['Favourites'],
        summary: 'Add a favourite colour (idempotent)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { 200: favoriteIds, 404: errorResponse('Colour not found') },
      },
      delete: {
        tags: ['Favourites'],
        summary: 'Remove a favourite colour',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { 200: favoriteIds },
      },
    },
    '/me/favorites/patterns/{id}': {
      post: {
        tags: ['Favourites'],
        summary: 'Add a favourite pattern (idempotent)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { 200: favoriteIds, 404: errorResponse('Pattern not found') },
      },
      delete: {
        tags: ['Favourites'],
        summary: 'Remove a favourite pattern',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { 200: favoriteIds },
      },
    },
  },
};
