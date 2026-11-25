// End-to-end test of the banking features: members, accounts, ledger, loans, jobs, reports.
// Skipped unless E2E_MONGO_URI is set (it WIPES that database):
//   E2E_MONGO_URI=mongodb://127.0.0.1:27017/sahakari_test npm test
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');

const URI = process.env.E2E_MONGO_URI;
const skip = URI ? false : 'set E2E_MONGO_URI to run the end-to-end business tests';

const mongoose = require('mongoose');
const request = require('supertest');
const createApp = require('../src/app');
const User = require('../src/models/User');
const Installment = require('../src/models/Installment');
const LedgerEntry = require('../src/models/LedgerEntry');
const SavingsAccount = require('../src/models/SavingsAccount');
const IntegrityCheckpoint = require('../src/models/IntegrityCheckpoint');
const { hashPassword } = require('../src/services/password.service');
const { computeHash } = require('../src/services/ledger.service');

const PW = 'Coop#Ledger2026';
const app = createApp();
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const call = (method, path, token, body) => {
  let r = request(app)[method](`/api${path}`);
  if (token) r = r.set(bearer(token));
  return body !== undefined ? r.send(body) : r;
};
const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: PW })).body.accessToken;

const ctx = {};

test('setup: staff accounts and a clean database', { skip }, async () => {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  for (const [name, role] of [['Asha Admin', 'admin'], ['Tara Teller', 'teller'], ['Ali Auditor', 'auditor']]) {
    await User.create({ fullName: name, email: `${role}@coop.test`, passwordHash: await hashPassword(PW), role, status: 'active' });
  }
  ctx.admin = await login('admin@coop.test'); ctx.teller = await login('teller@coop.test'); ctx.auditor = await login('auditor@coop.test');
  assert.ok(ctx.admin && ctx.teller && ctx.auditor);
});

test('members: teller creates, validation and duplicates are handled, search works', { skip }, async () => {
  let r = await call('post', '/members', ctx.teller, { fullName: 'Sita Rai', phone: '9800000001', email: 'sita@coop.test', address: { ward: '4', municipality: 'Itahari', district: 'Sunsari' }, nominee: { name: 'Ram Rai', relation: 'Husband', phone: '9800000009' } });
  assert.equal(r.status, 201); assert.equal(r.body.member.membershipNo, 'M-0001'); ctx.member = r.body.member;
  r = await call('post', '/members', ctx.teller, { fullName: 'Sita Again', phone: '9800000001' });
  assert.equal(r.body.error.code, 'DUPLICATE_PHONE');
  r = await call('post', '/members', ctx.teller, { fullName: 'X', phone: 'abc' });
  assert.equal(r.status, 400);
  r = await call('post', '/members', ctx.teller, { fullName: 'Hari Karki', phone: '9800000002' });
  assert.equal(r.body.member.membershipNo, 'M-0002'); ctx.member2 = r.body.member;
  r = await call('post', '/members', ctx.admin, { fullName: 'No Way', phone: '9811111111' });
  assert.equal(r.status, 403); // admin does not register members
  r = await call('get', '/members?q=sita', ctx.auditor);
  assert.equal(r.body.total, 1); assert.equal(r.body.members[0].fullName, 'Sita Rai');
  r = await call('patch', `/members/${ctx.member.id}`, ctx.teller, { status: 'suspended' });
  assert.equal(r.status, 403); // only an admin can suspend a member
  r = await call('patch', `/members/${ctx.member.id}`, ctx.teller, { email: 'sita.rai@coop.test' });
  assert.equal(r.status, 200); assert.equal(r.body.member.email, 'sita.rai@coop.test');
});

test('accounts and money: deposit, withdraw, limits, rounding', { skip }, async () => {
  assert.equal((await call('post', '/accounts', ctx.admin, { memberId: ctx.member.id })).status, 403);
  let r = await call('post', '/accounts', ctx.teller, { memberId: ctx.member.id });
  assert.equal(r.status, 201); assert.equal(r.body.account.accountNo, 'SA-0001'); ctx.acct = r.body.account;
  r = await call('post', '/accounts', ctx.teller, { memberId: ctx.member2.id }); ctx.acct2 = r.body.account;

  r = await call('post', `/accounts/${ctx.acct.id}/deposit`, ctx.teller, { amount: 50000, memo: 'opening' });
  assert.equal(r.status, 201); assert.equal(r.body.balancePaisa, 5000000); assert.equal(r.body.entry.seq, 1);
  for (const bad of [0, -5, 1.234, 'abc']) assert.equal((await call('post', `/accounts/${ctx.acct.id}/deposit`, ctx.teller, { amount: bad })).status, 400, String(bad));
  r = await call('post', `/accounts/${ctx.acct.id}/withdraw`, ctx.teller, { amount: 60000 });
  assert.equal(r.body.error.code, 'INSUFFICIENT_FUNDS');
  r = await call('post', `/accounts/${ctx.acct.id}/withdraw`, ctx.teller, { amount: 10000.5 });
  assert.equal(r.body.balancePaisa, 3999950);
  assert.equal((await call('post', `/accounts/${ctx.acct.id}/withdraw`, ctx.auditor, { amount: 1 })).status, 403);
  r = await call('post', `/accounts/${ctx.acct.id}/deposit`, ctx.teller, { amount: 0.5 }); // balance back to a round number
  assert.equal(r.body.balancePaisa, 4000000);
  await call('post', `/accounts/${ctx.acct2.id}/deposit`, ctx.teller, { amount: 1000 });
});

test('twenty deposits at the same time all land, with no gaps and no forks in the ledger', { skip }, async () => {
  const before = (await SavingsAccount.findById(ctx.acct.id)).balancePaisa;
  const rs = await Promise.all(Array.from({ length: 20 }, () => call('post', `/accounts/${ctx.acct.id}/deposit`, ctx.teller, { amount: 10 })));
  assert.ok(rs.every((x) => x.status === 201));
  assert.equal((await SavingsAccount.findById(ctx.acct.id)).balancePaisa, before + 20 * 1000);
  const v = (await call('post', '/ledger/verify', ctx.auditor)).body;
  assert.equal(v.ok, true, JSON.stringify(v.problems));
});

test('member registers, is approved and sees only their own account', { skip }, async () => {
  let r = await request(app).post('/api/auth/register').send({ fullName: 'Sita Rai', email: 'sita@coop.test', phone: '9800000001', membershipNo: 'M-0001', password: PW });
  assert.equal(r.status, 201);
  const u = await User.findOne({ email: 'sita@coop.test' });
  assert.equal((await call('patch', `/users/${u.id}/approve`, ctx.teller)).status, 200);
  ctx.member_t = await login('sita@coop.test');
  r = await call('get', '/accounts/mine', ctx.member_t);
  assert.equal(r.body.accounts.length, 1); assert.equal(r.body.accounts[0].accountNo, 'SA-0001');
  assert.equal((await call('get', `/accounts/${ctx.acct.id}`, ctx.member_t)).status, 200);
  assert.equal((await call('get', `/accounts/${ctx.acct2.id}`, ctx.member_t)).status, 404); // someone else's account looks like it does not exist
  assert.equal((await call('get', '/accounts', ctx.member_t)).status, 403);
  assert.equal((await call('get', '/members', ctx.member_t)).status, 403);
  assert.equal((await call('get', '/ledger', ctx.member_t)).status, 403);
});

test('loan: limits, risk score, approval needs a rate, disbursement creates schedule and money', { skip }, async () => {
  let r = await call('post', '/loans', ctx.member_t, { amount: 500, termMonths: 12 });
  assert.equal(r.body.error.code, 'AMOUNT_TOO_SMALL');
  const savings = (await SavingsAccount.findById(ctx.acct.id)).balancePaisa / 100;
  r = await call('post', '/loans', ctx.member_t, { amount: savings * 5 + 1, termMonths: 12 });
  assert.equal(r.body.error.code, 'EXCEEDS_LIMIT');
  assert.equal((await call('post', '/loans', ctx.member_t, { amount: 20000, termMonths: 2 })).status, 400);
  r = await call('post', '/loans', ctx.member_t, { amount: 100000, termMonths: 12, purpose: 'Shop stock' });
  assert.equal(r.status, 201); ctx.loan = r.body.loan;
  assert.equal(ctx.loan.status, 'applied'); assert.equal(ctx.loan.loanNo, 'L-0001');
  assert.ok(ctx.loan.riskScore >= 0 && ctx.loan.riskScore <= 100); assert.equal(ctx.loan.riskBreakdown.length, 4);
  assert.equal((await call('post', '/loans', ctx.member_t, { amount: 20000, termMonths: 12 })).body.error.code, 'OPEN_LOAN');

  assert.equal((await call('post', `/loans/${ctx.loan.id}/approve`, ctx.teller, {})).status, 403); // tellers cannot approve
  assert.equal((await call('post', `/loans/${ctx.loan.id}/approve`, ctx.admin, {})).body.error.code, 'RATE_NOT_SET');
  assert.equal((await call('post', '/rates', ctx.teller, { product: 'loan', ratePct: 12 })).status, 403);
  assert.equal((await call('post', '/rates', ctx.admin, { product: 'loan', ratePct: 12 })).status, 201);
  assert.equal((await call('post', '/rates', ctx.admin, { product: 'savings', ratePct: 6 })).status, 201);
  assert.equal((await call('post', '/rates', ctx.admin, { product: 'loan', ratePct: 150 })).status, 400);

  assert.equal((await call('post', `/loans/${ctx.loan.id}/disburse`, ctx.admin)).body.error.code, 'BAD_STATUS'); // not approved yet
  r = await call('post', `/loans/${ctx.loan.id}/approve`, ctx.admin, { note: 'Good record' });
  assert.equal(r.body.loan.status, 'approved'); assert.equal(r.body.loan.emiPaisa, 888488); assert.equal(r.body.loan.annualRatePct, 12);
  assert.equal((await call('post', '/rates', ctx.admin, { product: 'loan', ratePct: 20 })).status, 201); // a later rate change must not affect this loan

  const before = (await SavingsAccount.findById(ctx.acct.id)).balancePaisa;
  assert.equal((await call('post', `/loans/${ctx.loan.id}/disburse`, ctx.teller)).status, 403);
  r = await call('post', `/loans/${ctx.loan.id}/disburse`, ctx.admin);
  assert.equal(r.status, 200); assert.equal(r.body.installments.length, 12); assert.equal(r.body.loan.annualRatePct, 12);
  assert.equal((await SavingsAccount.findById(ctx.acct.id)).balancePaisa, before + 10000000);
  assert.equal((await call('post', `/loans/${ctx.loan.id}/disburse`, ctx.admin)).body.error.code, 'BAD_STATUS'); // cannot disburse twice
});

test('repayment: oldest instalments first, partial payments, overpayment blocked, loan closes', { skip }, async () => {
  assert.equal((await call('post', `/loans/${ctx.loan.id}/repay`, ctx.member_t, { amount: 100 })).status, 403);
  let r = await call('post', `/loans/${ctx.loan.id}/repay`, ctx.teller, { amount: 8884.88 });
  assert.equal(r.status, 201); assert.equal(r.body.installments[0].status, 'paid'); assert.equal(r.body.installments[1].status, 'pending');
  r = await call('post', `/loans/${ctx.loan.id}/repay`, ctx.teller, { amount: 100 });
  assert.equal(r.body.installments[1].status, 'partial'); assert.equal(r.body.installments[1].paidPaisa, 10000);
  r = await call('post', `/loans/${ctx.loan.id}/repay`, ctx.teller, { amount: 99999999 });
  assert.equal(r.body.error.code, 'OVERPAYMENT');

  r = await call('get', `/loans/${ctx.loan.id}`, ctx.member_t); // the member can see their own loan and schedule
  assert.equal(r.status, 200); assert.equal(r.body.installments.length, 12);
  assert.equal((await call('get', `/loans/${ctx.loan.id}`, ctx.teller)).status, 200);
  const remaining = r.body.remainingPaisa;
  r = await call('post', `/loans/${ctx.loan.id}/repay`, ctx.teller, { amount: remaining / 100 });
  assert.equal(r.body.closed, true); assert.equal(r.body.loan.status, 'closed'); assert.equal(r.body.remainingPaisa, 0);
  // a closed loan frees the member to apply again
  r = await call('post', '/loans', ctx.member_t, { amount: 20000, termMonths: 6 });
  assert.equal(r.status, 201); ctx.loan2 = r.body.loan;
  assert.ok(r.body.loan.riskScore > ctx.loan.riskScore - 100); // history now exists (paid in full)
  const rej = await call('post', `/loans/${ctx.loan2.id}/reject`, ctx.admin, { note: 'Not now' });
  assert.equal(rej.body.loan.status, 'rejected');
  assert.equal((await call('post', `/loans/${ctx.loan2.id}/reject`, ctx.admin, {})).status, 400);
});

test('overdue handling, reminders and notifications (idempotent), monthly interest (idempotent)', { skip }, async () => {
  // a second loan so there is something to be late on
  let r = await call('post', '/loans', ctx.member_t, { amount: 30000, termMonths: 6 });
  const l3 = r.body.loan;
  await call('post', `/loans/${l3.id}/approve`, ctx.admin, {}); await call('post', `/loans/${l3.id}/disburse`, ctx.admin);
  const first = await Installment.findOne({ loan: l3.id, no: 1 });
  const t = new Date(); first.dueDate = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - 10)); await first.save(); // due 10 days ago (due dates are UTC midnight)

  r = await call('get', '/loans/overdue', ctx.teller);
  assert.equal(r.body.overdue.length, 1); assert.equal(r.body.overdue[0].daysOverdue, 10); assert.equal(r.body.overdue[0].membershipNo, 'M-0001');
  assert.equal((await call('get', '/loans/overdue', ctx.member_t)).status, 403);

  r = await call('post', '/jobs/run', ctx.admin);
  assert.equal(r.status, 200); assert.ok(r.body.result.remindersSent >= 1); assert.ok(r.body.result.interest.posted >= 1);
  assert.equal((await call('post', '/jobs/run', ctx.teller)).status, 403);
  const again = (await call('post', '/jobs/run', ctx.admin)).body.result;
  assert.equal(again.remindersSent, 0); assert.equal(again.interest.posted, 0); // nothing is sent or posted twice

  r = await call('get', '/notifications', ctx.member_t);
  assert.ok(r.body.unread >= 3); // approved, disbursed, overdue
  assert.ok(r.body.notifications.some((n) => n.type === 'overdue'));
  assert.equal((await call('post', `/notifications/${r.body.notifications[0].id}/read`, ctx.member_t)).status, 200);
  assert.equal((await call('post', `/notifications/${r.body.notifications[0].id}/read`, ctx.teller)).status, 404);
  await call('post', '/notifications/read-all', ctx.member_t);
  assert.equal((await call('get', '/notifications', ctx.member_t)).body.unread, 0);
  assert.ok((await LedgerEntry.countDocuments({ type: 'interest' })) >= 1);
});

test('statements: JSON and PDF, own account only', { skip }, async () => {
  let r = await call('get', `/accounts/${ctx.acct.id}/statement`, ctx.member_t);
  assert.equal(r.status, 200); assert.ok(r.body.entries.length >= 5);
  assert.equal(r.body.closingPaisa, (await SavingsAccount.findById(ctx.acct.id)).balancePaisa);
  const pdf = await request(app).get(`/api/accounts/${ctx.acct.id}/statement?format=pdf`).set(bearer(ctx.member_t)).buffer(true).parse((res, cb) => {
    const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(pdf.status, 200); assert.match(pdf.headers['content-type'], /application\/pdf/);
  assert.equal(pdf.body.slice(0, 4).toString(), '%PDF');
  assert.equal((await call('get', `/accounts/${ctx.acct2.id}/statement`, ctx.member_t)).status, 404);
  r = await call('get', `/accounts/${ctx.acct.id}/statement?from=2999-01-01`, ctx.teller);
  assert.equal(r.body.entries.length, 0);
});

test('ledger: reversal never edits history; integrity check and checkpoints pass', { skip }, async () => {
  const dep = await LedgerEntry.findOne({ type: 'deposit', memo: 'opening' });
  let r = await call('post', `/ledger/${dep.id}/reverse`, ctx.teller, { reason: 'x' });
  assert.equal(r.status, 403);
  const bal = (await SavingsAccount.findById(ctx.acct.id)).balancePaisa;
  r = await call('post', `/ledger/${dep.id}/reverse`, ctx.admin, { reason: 'Wrong account' });
  assert.equal(r.status, 201); assert.equal(r.body.entry.type, 'reversal'); assert.equal(r.body.entry.deltaPaisa, -5000000);
  assert.equal((await SavingsAccount.findById(ctx.acct.id)).balancePaisa, bal - 5000000);
  assert.equal((await call('post', `/ledger/${dep.id}/reverse`, ctx.admin, { reason: 'again' })).body.error.code, 'ALREADY_REVERSED');
  const disb = await LedgerEntry.findOne({ type: 'loan_disbursement' });
  assert.equal((await call('post', `/ledger/${disb.id}/reverse`, ctx.admin, { reason: 'try' })).body.error.code, 'NOT_REVERSIBLE');

  r = await call('post', '/ledger/verify', ctx.auditor);
  assert.equal(r.body.ok, true, JSON.stringify(r.body.problems)); assert.ok(r.body.entriesChecked > 20); assert.equal(r.body.firstBadSeq, null);
  assert.equal((await call('post', '/ledger/verify', ctx.admin)).status, 403); // admin cannot run the auditor's check
  r = await call('post', '/ledger/checkpoints', ctx.auditor);
  assert.equal(r.status, 201); ctx.checkpoint = r.body.checkpoint;
  assert.equal((await call('post', '/ledger/checkpoints', ctx.auditor)).body.created, false);
  assert.ok((await call('get', '/ledger?type=deposit&limit=5', ctx.auditor)).body.entries.every((e) => e.type === 'deposit'));
});

test('TAMPERING IS DETECTED: edited amount, rewritten history, deleted entry', { skip }, async () => {
  const entries = await LedgerEntry.find().sort({ seq: 1 }).lean();
  const target = entries[4];
  const coll = LedgerEntry.collection;

  // 1. someone edits an amount directly in the database
  await coll.updateOne({ _id: target._id }, { $set: { amountPaisa: target.amountPaisa + 100000 } });
  let v = (await call('post', '/ledger/verify', ctx.auditor)).body;
  assert.equal(v.ok, false); assert.equal(v.firstBadSeq, target.seq); assert.equal(v.problems[0].reason, 'hash_mismatch');
  await coll.updateOne({ _id: target._id }, { $set: { amountPaisa: target.amountPaisa } });
  assert.equal((await call('post', '/ledger/verify', ctx.auditor)).body.ok, true);

  // 2. a skilled attacker who knows the secret edits a memo and re-computes every later hash: the chain is consistent,
  //    but the saved checkpoint no longer matches
  let prev = entries[3].hash;
  for (let i = 4; i < entries.length; i += 1) {
    const e = { ...entries[i], prevHash: prev, memo: i === 4 ? 'edited later' : entries[i].memo };
    e.hash = computeHash(e); prev = e.hash;
    await coll.updateOne({ _id: e._id }, { $set: { prevHash: e.prevHash, hash: e.hash, memo: e.memo } });
  }
  v = (await call('post', '/ledger/verify', ctx.auditor)).body;
  const cps = await IntegrityCheckpoint.find().sort({ upToSeq: 1 }).lean(); // the daily job also saved checkpoints earlier
  const firstAffected = cps.find((c) => c.upToSeq >= target.seq + 1);
  assert.ok(cps.length >= 2);
  assert.equal(v.ok, false); assert.equal(v.problems[0].reason, 'checkpoint_mismatch'); assert.equal(v.firstBadSeq, firstAffected.upToSeq);
  for (const e of entries.slice(4)) await coll.updateOne({ _id: e._id }, { $set: { prevHash: e.prevHash, hash: e.hash, memo: e.memo } });
  assert.equal((await call('post', '/ledger/verify', ctx.auditor)).body.ok, true);

  // 3. the newest entry is deleted
  const last = entries[entries.length - 1];
  await coll.deleteOne({ _id: last._id });
  v = (await call('post', '/ledger/verify', ctx.auditor)).body;
  assert.equal(v.ok, false); assert.equal(v.problems[0].reason, 'entries_missing');
  await coll.insertOne(last);
  assert.equal((await call('post', '/ledger/verify', ctx.auditor)).body.ok, true);

  // 4. an account balance is edited without a ledger entry
  await SavingsAccount.collection.updateOne({ _id: new mongoose.Types.ObjectId(ctx.acct.id) }, { $inc: { balancePaisa: 500 } });
  v = (await call('post', '/ledger/verify', ctx.auditor)).body;
  assert.equal(v.ok, false); assert.equal(v.problems[0].reason, 'account_balance_mismatch');
  await SavingsAccount.collection.updateOne({ _id: new mongoose.Types.ObjectId(ctx.acct.id) }, { $inc: { balancePaisa: -500 } });
  assert.equal((await call('post', '/ledger/verify', ctx.auditor)).body.ok, true);
});

test('reports, exports, dashboards and the audit log', { skip }, async () => {
  let r = await call('get', '/reports/summary', ctx.teller);
  assert.equal(r.status, 200); assert.equal(r.body.summary.activeMembers, 2); assert.equal(r.body.summary.savingsAccounts, 2);
  assert.equal(r.body.summary.overdueInstallments, 1); assert.ok(r.body.summary.totalSavingsPaisa > 0); assert.ok(r.body.summary.lastIntegrityCheck.ok === true);
  assert.equal((await call('get', '/reports/summary', ctx.member_t)).status, 403);
  const now = new Date(); const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  r = await call('get', `/reports/monthly?month=${month}`, ctx.admin);
  assert.ok(r.body.report.rows.find((x) => x.type === 'deposit').count >= 22);
  assert.equal((await call('get', '/reports/monthly?month=2026-13', ctx.admin)).status, 400);
  r = await call('get', '/reports/defaulters', ctx.teller); assert.equal(r.body.defaulters.length, 1);

  assert.equal((await call('get', '/reports/export/ledger', ctx.teller)).status, 403); // tellers can view but not export
  r = await call('get', '/reports/export/ledger', ctx.auditor);
  assert.equal(r.status, 200); assert.match(r.headers['content-type'], /text\/csv/);
  assert.ok(r.text.startsWith('Seq,Date,Type')); assert.ok(r.text.split('\r\n').length > 20);
  assert.equal((await call('get', '/reports/export/defaulters', ctx.auditor)).status, 200);
  assert.equal((await call('get', '/reports/export/passwords', ctx.auditor)).status, 400);

  r = await call('get', '/dashboard', ctx.admin); assert.equal(r.body.role, 'admin'); assert.ok(r.body.summary.ledgerEntries > 20);
  r = await call('get', '/dashboard', ctx.member_t); assert.equal(r.body.role, 'member'); assert.equal(r.body.accounts.length, 1);

  assert.equal((await call('get', '/audit', ctx.teller)).status, 403);
  r = await call('get', '/audit?limit=100', ctx.auditor);
  const actions = r.body.actions;
  for (const a of ['member.create', 'account.open', 'loan.apply', 'loan.approve', 'loan.disburse', 'loan.repay', 'loan.reject', 'ledger.reverse', 'ledger.verify', 'rate.set', 'jobs.run', 'report.export']) {
    assert.ok(actions.includes(a), `missing audit action ${a}`);
  }
  r = await call('get', '/audit?action=ledger.verify&outcome=failure', ctx.auditor);
  assert.ok(r.body.total >= 3); // the failed checks from the tampering test were logged
});

test('teardown', { skip }, async () => { await mongoose.disconnect(); });
