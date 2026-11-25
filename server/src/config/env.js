require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// A fixed fallback is allowed only outside production so that tests and first runs work.
const accessSecret =
  process.env.JWT_ACCESS_SECRET || (isProd ? '' : 'dev-only-secret-do-not-use-in-production-0123456789');

if (accessSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must be set and at least 32 characters long');
}

const ledgerSecret =
  process.env.LEDGER_HMAC_SECRET || (isProd ? '' : 'dev-only-ledger-secret-do-not-use-in-production-0123456789');
if (ledgerSecret.length < 32) {
  throw new Error('LEDGER_HMAC_SECRET must be set and at least 32 characters long');
}

module.exports = Object.freeze({
  NODE_ENV,
  isProd,
  isTest,
  PORT: Number(process.env.PORT || 5000),
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sahakari_ledger',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',

  JWT_ACCESS_SECRET: accessSecret,
  LEDGER_HMAC_SECRET: ledgerSecret, // keep this OUTSIDE the database: it is what makes the ledger hash chain hard to forge
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL_DAYS: 7,
  RESET_TOKEN_TTL_MINUTES: 30,

  BCRYPT_ROUNDS: isTest ? 4 : 12,
  MAX_FAILED_LOGINS: 5,
  LOCK_MINUTES: 15,

  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  MAIL_FROM: process.env.MAIL_FROM || 'Sahakari Ledger <no-reply@example.com>',
});
