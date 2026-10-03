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
const auth = [{ bearerAuth: [] }];

const image = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'Short-lived signed URL' },
    width: { type: 'integer' },
    height: { type: 'integer' },
    mimeType: { type: 'string' },
    sizeBytes: { type: 'integer' },
  },
};

module.exports = {
  schemas: {
    Project: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        userId: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'saved'] },
        originalImage: image,
        workingImage: { ...image, description: 'Downscaled (max 2000 px) copy used by the editor' },
        thumbnailUrl: { type: 'string' },
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              variantId: { type: 'string' },
              name: { type: 'string' },
              regions: { type: 'array', items: { type: 'object' } },
            },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  paths: {
    '/projects': {
      post: {
        tags: ['Projects'],
        summary: 'Upload a room photo and create a project',
        description:
          'JPG/PNG only, checked by file content. The image is re-encoded, which removes EXIF/GPS metadata. Size limit comes from admin settings (default 10 MB).',
        security: auth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['image', 'ownershipConfirmed'],
                properties: {
                  image: { type: 'string', format: 'binary' },
                  title: { type: 'string', example: 'Living room' },
                  ownershipConfirmed: {
                    type: 'boolean',
                    description: 'User confirms they own the photo or have permission',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: json({ type: 'object', properties: { project: ref('Project') } }, 'Created'),
          400: errorResponse('Invalid, damaged, too small, or unconfirmed upload'),
          401: errorResponse('Not logged in'),
          413: errorResponse('File too large'),
          429: errorResponse('Too many uploads'),
        },
      },
      get: {
        tags: ['Projects'],
        summary: "List the current user's projects (newest first)",
        security: auth,
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'saved'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 12, maximum: 50 } },
        ],
        responses: {
          200: json({
            type: 'object',
            properties: {
              items: { type: 'array', items: ref('Project') },
              total: { type: 'integer' },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              pages: { type: 'integer' },
            },
          }),
        },
      },
    },
    '/projects/{id}': {
      get: {
        tags: ['Projects'],
        summary: 'Get a project (owner or admin)',
        security: auth,
        parameters: [idParam],
        responses: {
          200: json({ type: 'object', properties: { project: ref('Project') } }),
          404: errorResponse('Not found or not yours'),
        },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete a project and its images permanently (owner or admin)',
        security: auth,
        parameters: [idParam],
        responses: {
          204: { description: 'Deleted' },
          404: errorResponse('Not found or not yours'),
        },
      },
    },
    '/files/{key}': {
      get: {
        tags: ['Projects'],
        summary: 'Fetch a private image via its signed URL',
        description: 'Use the URLs returned in project responses; they expire after an hour.',
        parameters: [
          { name: 'key', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'exp', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'sig', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Image', content: { 'image/jpeg': {}, 'image/png': {} } },
          403: errorResponse('Invalid or expired link'),
        },
      },
    },
    '/settings/public': {
      get: {
        tags: ['System'],
        summary: 'Public settings (upload limits, allowed formats, disclaimer text)',
        responses: {
          200: json({
            type: 'object',
            properties: {
              settings: {
                type: 'object',
                properties: {
                  maxUploadMb: { type: 'number', example: 10 },
                  allowedFormats: { type: 'array', items: { type: 'string' } },
                  defaultFinish: { type: 'string' },
                  disclaimerText: { type: 'string' },
                },
              },
            },
          }),
        },
      },
    },
  },
};
