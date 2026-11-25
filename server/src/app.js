const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  if (env.isProd) app.set('trust proxy', 1); // correct client IPs behind a hosting proxy

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize()); // strips $ and . operators from input to block NoSQL injection
  if (!env.isTest && process.env.QUIET_LOGS !== '1') app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use('/api', apiLimiter, routes);

  // Optional single-service deployment: if the React app has been built (client/dist), serve it from here too.
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (!env.isTest && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { maxAge: env.isProd ? '1h' : 0 }));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
