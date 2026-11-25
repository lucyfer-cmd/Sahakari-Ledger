const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, res) =>
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } }),
};

// Strict limit for credential endpoints (login, register, forgot/reset password).
const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });
// General limit for the rest of the API.
const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 600 });

module.exports = { authLimiter, apiLimiter };
