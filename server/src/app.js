const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const routes = require('./routes');
const openapi = require('./docs/openapi');
const { sanitize } = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rate-limit');
const { notFound, errorHandler } = require('./middleware/error-handler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / non-browser requests (no Origin header) and the allow-list
        if (!origin || env.clientUrls.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    }),
  );

  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // Saving a design carries brush strokes, so that one route gets a larger body limit
  const projectJson = express.json({ limit: '5mb' });
  const defaultJson = express.json({ limit: '1mb' });
  app.use((req, res, next) =>
    req.method === 'PUT' && /^\/api\/v1\/projects\/[^/]+\/?$/.test(req.path)
      ? projectJson(req, res, next)
      : defaultJson(req, res, next),
  );
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(sanitize);

  // Swagger UI needs inline scripts/styles, so relax CSP for the docs route only
  app.use(
    '/api/docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openapi),
  );

  // Public catalogue assets (pattern tiles). User uploads are NOT served from here.
  app.use(
    '/static',
    helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
    express.static(path.join(__dirname, '../public'), {
      maxAge: '7d',
      index: false,
      setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*'),
    }),
  );

  app.use('/api/v1', apiLimiter, routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
