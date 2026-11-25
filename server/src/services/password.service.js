const bcrypt = require('bcryptjs');
const env = require('../config/env');

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

// Short blocklist for the prototype. A production system would check a larger breached-password list.
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'qwerty123', 'qwertyuiop', '1234567890',
  '123456789', 'iloveyou', 'admin123', 'welcome123', 'letmein123', 'changeme', 'sahakari123',
]);

/** Returns a list of human-readable problems. An empty list means the password is acceptable. */
function validatePasswordStrength(password, { email = '', fullName = '' } = {}) {
  const problems = [];
  if (typeof password !== 'string') return ['Password is required'];
  if (password.length < MIN_LENGTH) problems.push(`Use at least ${MIN_LENGTH} characters`);
  if (password.length > MAX_LENGTH) problems.push(`Use at most ${MAX_LENGTH} characters`);
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) problems.push('Mix upper-case and lower-case letters');
  if (!/\d/.test(password)) problems.push('Include at least one digit');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('Include at least one symbol');

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) problems.push('This password is too common');
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 3 && lower.includes(local)) problems.push('Do not include your email name');
  const firstName = String(fullName).trim().split(/\s+/)[0].toLowerCase();
  if (firstName.length >= 3 && lower.includes(firstName)) problems.push('Do not include your name');
  return problems;
}

const hashPassword = (plain) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Used when the email does not exist, so that response time does not reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.BCRYPT_ROUNDS);
const fakeVerify = (plain) => bcrypt.compare(plain, DUMMY_HASH);

module.exports = { validatePasswordStrength, hashPassword, verifyPassword, fakeVerify, MIN_LENGTH, MAX_LENGTH };
