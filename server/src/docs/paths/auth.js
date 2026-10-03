const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const authResult = {
  description: 'Authenticated',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResult' } } },
};

const userResult = {
  description: 'Current user',
  content: {
    'application/json': {
      schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } },
    },
  },
};

const jsonBody = (properties, required) => ({
  required: true,
  content: { 'application/json': { schema: { type: 'object', required, properties } } },
});

module.exports = {
  schemas: {
    User: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['user', 'admin'] },
        isActive: { type: 'boolean' },
        favoriteColors: { type: 'array', items: { type: 'string' } },
        favoritePatterns: { type: 'array', items: { type: 'string' } },
        lastLoginAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    AuthResult: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'JWT access token (expires per JWT_EXPIRES_IN)' },
        user: { $ref: '#/components/schemas/User' },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: jsonBody(
          {
            name: { type: 'string', example: 'Asha Rao' },
            email: { type: 'string', format: 'email', example: 'asha@example.com' },
            password: {
              type: 'string',
              minLength: 8,
              description: 'At least 8 characters with a letter and a number',
              example: 'Paint1234',
            },
          },
          ['name', 'email', 'password'],
        ),
        responses: {
          201: authResult,
          400: errorResponse('Validation failed'),
          409: errorResponse('Email already registered'),
          429: errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT',
        requestBody: jsonBody(
          {
            email: { type: 'string', format: 'email', example: 'admin@swpv.local' },
            password: { type: 'string', example: 'ChangeMe123!' },
          },
          ['email', 'password'],
        ),
        responses: {
          200: authResult,
          401: errorResponse('Invalid email or password'),
          403: errorResponse('Account deactivated'),
          429: errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out (client discards the token; event is recorded)',
        security: [{ bearerAuth: [] }],
        responses: { 204: { description: 'Logged out' }, 401: errorResponse('Not logged in') },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current user',
        security: [{ bearerAuth: [] }],
        responses: { 200: userResult, 401: errorResponse('Not logged in') },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update name and/or email',
        security: [{ bearerAuth: [] }],
        requestBody: jsonBody(
          { name: { type: 'string' }, email: { type: 'string', format: 'email' } },
          [],
        ),
        responses: {
          200: userResult,
          400: errorResponse('Validation failed'),
          401: errorResponse('Not logged in'),
          409: errorResponse('Email already in use'),
        },
      },
    },
    '/auth/password': {
      patch: {
        tags: ['Auth'],
        summary: 'Change password (invalidates all other sessions, returns a fresh token)',
        security: [{ bearerAuth: [] }],
        requestBody: jsonBody(
          { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } },
          ['currentPassword', 'newPassword'],
        ),
        responses: {
          200: authResult,
          400: errorResponse('Validation failed or current password incorrect'),
          401: errorResponse('Not logged in'),
        },
      },
    },
  },
};
