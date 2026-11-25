const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const RefreshToken = require('../models/RefreshToken');

const REFRESH_COOKIE = 'sl_refresh';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(48).toString('base64url');

function signAccessToken(user) {
  return jwt.sign({ role: user.role, ver: user.tokenVersion }, env.JWT_ACCESS_SECRET, {
    subject: user._id.toString(),
    expiresIn: env.ACCESS_TOKEN_TTL,
    algorithm: 'HS256',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
}

/** Creates a new refresh token. Pass an existing family when rotating. */
async function issueRefreshToken(user, meta = {}, family = crypto.randomUUID()) {
  const raw = randomToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(raw),
    family,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    userAgent: (meta.userAgent || '').slice(0, 300),
    ip: meta.ip || null,
  });
  return { raw, family };
}

/**
 * Rotation with reuse detection:
 * - a valid token is revoked and replaced by a new one in the same family;
 * - presenting an already-revoked token means it was probably stolen, so the whole family is revoked.
 * Returns { userId, raw, family } or null when the token is not usable.
 */
async function rotateRefreshToken(rawToken, meta = {}) {
  if (!rawToken) return null;
  const hash = sha256(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash: hash });
  if (!existing) return null;

  if (existing.revokedAt) {
    await RefreshToken.updateMany({ family: existing.family, revokedAt: null }, { revokedAt: new Date() });
    return { reuseDetected: true, userId: existing.user };
  }
  if (existing.expiresAt <= new Date()) return null;

  const next = await issueRefreshToken({ _id: existing.user }, meta, existing.family);
  existing.revokedAt = new Date();
  existing.replacedByHash = sha256(next.raw);
  await existing.save();
  return { userId: existing.user, raw: next.raw, family: next.family };
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  await RefreshToken.updateOne({ tokenHash: sha256(rawToken), revokedAt: null }, { revokedAt: new Date() });
}

async function revokeAllForUser(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

module.exports = {
  REFRESH_COOKIE,
  sha256,
  randomToken,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  refreshCookieOptions,
};
