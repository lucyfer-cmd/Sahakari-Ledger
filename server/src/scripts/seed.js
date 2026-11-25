// Prepares a fresh database.
//   npm run seed        -> first administrator and the default interest rates
//   npm run seed:demo   -> also staff logins, sample members, accounts, loans and a verified ledger (good for demos)
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const business = require('../config/business');
const User = require('../models/User');
const InterestRate = require('../models/InterestRate');
const Member = require('../models/Member');
const { hashPassword, validatePasswordStrength } = require('../services/password.service');

const DEMO = process.argv.includes('--demo');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo#Ledger2026';

async function ensureUser({ fullName, email, role, password, mustChangePassword = false }) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({ fullName, email, role, status: 'active', mustChangePassword, passwordHash: await hashPassword(password) });
}

async function demoData(adminEmail, adminPassword) {
  if (await Member.exists({ membershipNo: 'M-0001' })) { console.log('Demo data already exists, skipping'); return; }
  process.env.QUIET_LOGS = '1';
  const createApp = require('../app');
  const server = await new Promise((resolve) => { const s = createApp().listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, token, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data.error)}`);
    return data;
  };
  const login = async (email, password) => (await call('POST', '/auth/login', null, { email, password })).accessToken;

  await ensureUser({ fullName: 'Tara Teller', email: 'teller@example.com', role: 'teller', password: DEMO_PASSWORD });
  await ensureUser({ fullName: 'Ali Auditor', email: 'auditor@example.com', role: 'auditor', password: DEMO_PASSWORD });
  // The seeded admin must change the password at first login, so use a normal admin for the demo steps.
  await ensureUser({ fullName: 'Demo Admin', email: 'demoadmin@example.com', role: 'admin', password: DEMO_PASSWORD });
  const admin = await login('demoadmin@example.com', DEMO_PASSWORD);
  const teller = await login('teller@example.com', DEMO_PASSWORD);
  const auditor = await login('auditor@example.com', DEMO_PASSWORD);

  const people = [
    ['Sita Rai', '9800000001', 'sita@example.com', 85000], ['Ram Thapa', '9800000002', 'ram@example.com', 42000], ['Gita Karki', '9800000003', 'gita@example.com', 120000],
    ['Hari Gurung', '9800000004', 'hari@example.com', 15000], ['Maya Limbu', '9800000005', 'maya@example.com', 60000],
  ];
  const accounts = [];
  for (const [fullName, phone, email, amount] of people) {
    const { member } = await call('POST', '/members', teller, { fullName, phone, email, address: { ward: '5', municipality: 'Itahari', district: 'Sunsari' }, nominee: { name: 'Family member', relation: 'Relative' } });
    const { account } = await call('POST', '/accounts', teller, { memberId: member.id });
    await call('POST', `/accounts/${account.id}/deposit`, teller, { amount, memo: 'Opening deposit' });
    await call('POST', `/accounts/${account.id}/deposit`, teller, { amount: Math.round(amount / 10), memo: 'Monthly saving' });
    accounts.push(account);
  }
  await call('POST', `/accounts/${accounts[3].id}/withdraw`, teller, { amount: 2000, memo: 'Cash withdrawal' });

  // member logins for Sita and Ram (registered by themselves, approved by the teller)
  for (const [i, [fullName, phone, email]] of people.slice(0, 2).entries()) {
    await call('POST', '/auth/register', null, { fullName, email, phone, membershipNo: `M-000${i + 1}`, password: DEMO_PASSWORD });
    const u = await User.findOne({ email });
    await call('PATCH', `/users/${u.id}/approve`, teller);
  }
  // Sita has a running loan with two instalments paid; Ram has just applied
  const sita = await login('sita@example.com', DEMO_PASSWORD);
  const ram = await login('ram@example.com', DEMO_PASSWORD);
  const { loan } = await call('POST', '/loans', sita, { amount: 50000, termMonths: 12, purpose: 'Buy stock for the shop' });
  await call('POST', `/loans/${loan.id}/approve`, admin, { note: 'Good savings record' });
  await call('POST', `/loans/${loan.id}/disburse`, admin);
  const detail = await call('GET', `/loans/${loan.id}`, teller);
  await call('POST', `/loans/${loan.id}/repay`, teller, { amount: (detail.previewEmiPaisa * 2) / 100 });
  await call('POST', '/loans', ram, { amount: 20000, termMonths: 6, purpose: 'School fees' });

  await call('POST', '/ledger/checkpoints', auditor);
  const check = await call('POST', '/ledger/verify', auditor);
  server.close();
  console.log(`Demo data ready. Ledger checked: ${check.ok ? 'OK' : 'PROBLEM'} (${check.entriesChecked} entries)`);
  console.log(`\nLogins (password for all demo accounts: ${DEMO_PASSWORD})`);
  console.log('  demoadmin@example.com  admin      teller@example.com  teller      auditor@example.com  auditor');
  console.log('  sita@example.com       member     ram@example.com     member');
}

(async () => {
  const email = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase();
  const name = process.env.SEED_ADMIN_NAME || 'System Administrator';
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  if (!email || validatePasswordStrength(password, { email, fullName: name }).length) {
    console.error('Set SEED_ADMIN_EMAIL and a strong SEED_ADMIN_PASSWORD in server/.env first.');
    process.exit(1);
  }
  await mongoose.connect(env.MONGO_URI);

  if (!(await User.exists({ email }))) {
    await ensureUser({ fullName: name, email, role: 'admin', password, mustChangePassword: true });
    console.log(`Admin created: ${email} (must change password at first login)`);
  } else console.log('Admin already exists, skipping');

  for (const product of ['savings', 'loan']) {
    if (!(await InterestRate.exists({ product }))) {
      await InterestRate.create({ product, ratePct: business.DEFAULT_RATES[product], effectiveFrom: new Date('2020-01-01') });
      console.log(`Default ${product} rate set to ${business.DEFAULT_RATES[product]}% per year`);
    }
  }
  if (DEMO) await demoData(email, password);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
