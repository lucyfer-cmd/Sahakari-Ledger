const env = require('../config/env');

const notFound = (req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'A record with these details already exists' } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status >= 500 && env.isProd ? 'Something went wrong' : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
};

module.exports = { notFound, errorHandler };
