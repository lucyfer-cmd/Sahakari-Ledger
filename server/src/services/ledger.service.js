const crypto = require('crypto');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const LedgerEntry = require('../models/LedgerEntry');
const SavingsAccount = require('../models/SavingsAccount');
const IntegrityCheckpoint = require('../models/IntegrityCheckpoint');

const GENESIS = '0'.repeat(64);
const str = (v) => (v ? String(v) : '');

/** The exact text that is hashed. Changing any field of an entry changes this text, and therefore the hash. */
function canonical(e) {
  return JSON.stringify([
    e.seq, e.prevHash, e.type, e.amountPaisa, e.deltaPaisa, str(e.account), str(e.loan),
    e.balanceAfterPaisa === null || e.balanceAfterPaisa === undefined ? null : e.balanceAfterPaisa,
    str(e.recordedBy), new Date(e.createdAt).toISOString(), e.memo || '', str(e.reversalOf), e.period || '',
  ]);
}
/** HMAC-SHA256 with a secret that is NOT stored in the database. */
const computeHash = (e) => crypto.createHmac('sha256', env.LEDGER_HMAC_SECRET).update(canonical(e)).digest('hex');

// One money movement at a time. (This protects a single server. With several servers you would use database transactions.)
let chain = Promise.resolve();
function withLock(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function appendUnlocked(data) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const last = await LedgerEntry.findOne().sort({ seq: -1 }).lean();
    const entry = { ...data, seq: (last ? last.seq : 0) + 1, prevHash: last ? last.hash : GENESIS, createdAt: new Date() };
    entry.hash = computeHash(entry);
    try {
      return await LedgerEntry.create(entry);
    } catch (err) {
      if (err.code === 11000 && attempt < 4) continue; // another writer took this seq number: try again
      throw err;
    }
  }
  throw new AppError(500, 'LEDGER_BUSY', 'Could not write the ledger entry');
}

/** Moves money on an account and records it in the ledger, as one step. */
function movement({ type, accountId, loanId = null, amountPaisa, deltaPaisa, userId = null, memo = '', reversalOf = null, period = '' }) {
  return withLock(async () => {
    let balanceAfterPaisa = null;
    let account = null;
    if (accountId) {
      account = await SavingsAccount.findById(accountId);
      if (!account) throw new AppError(404, 'NOT_FOUND', 'Account not found');
      if (account.status !== 'active') throw new AppError(409, 'ACCOUNT_CLOSED', 'This account is closed');
      balanceAfterPaisa = account.balancePaisa + deltaPaisa;
      if (balanceAfterPaisa < 0) throw new AppError(409, 'INSUFFICIENT_FUNDS', 'Not enough balance for this withdrawal');
    }
    const entry = await appendUnlocked({
      type, amountPaisa, deltaPaisa, account: accountId, loan: loanId, balanceAfterPaisa,
      recordedBy: userId, memo, reversalOf, period,
    });
    if (account) { account.balancePaisa = balanceAfterPaisa; await account.save(); }
    return entry;
  });
}

const deposit = (accountId, amountPaisa, userId, memo) => movement({ type: 'deposit', accountId, amountPaisa, deltaPaisa: amountPaisa, userId, memo });
const withdraw = (accountId, amountPaisa, userId, memo) => movement({ type: 'withdrawal', accountId, amountPaisa, deltaPaisa: -amountPaisa, userId, memo });
const postInterest = (accountId, amountPaisa, period) => movement({ type: 'interest', accountId, amountPaisa, deltaPaisa: amountPaisa, memo: `Monthly interest ${period}`, period });
const postDisbursement = (accountId, loanId, amountPaisa, userId, memo) =>
  movement({ type: 'loan_disbursement', accountId, loanId, amountPaisa, deltaPaisa: amountPaisa, userId, memo });
// Loan repayments are collected in cash by the teller, so they do not change a savings balance.
const postRepayment = (loanId, amountPaisa, userId, memo) =>
  movement({ type: 'loan_repayment', accountId: null, loanId, amountPaisa, deltaPaisa: 0, userId, memo });

/** A mistake is never edited away. It is cancelled by a new entry that does the opposite. */
async function reverse(entryId, reason, userId) {
  const original = await LedgerEntry.findById(entryId);
  if (!original) throw new AppError(404, 'NOT_FOUND', 'Ledger entry not found');
  if (!['deposit', 'withdrawal', 'interest'].includes(original.type)) {
    throw new AppError(409, 'NOT_REVERSIBLE', 'Only deposits, withdrawals and interest entries can be reversed');
  }
  if (await LedgerEntry.exists({ reversalOf: original._id })) throw new AppError(409, 'ALREADY_REVERSED', 'This entry was already reversed');
  return movement({
    type: 'reversal', accountId: original.account, amountPaisa: original.amountPaisa, deltaPaisa: -original.deltaPaisa,
    userId, memo: `Reversal of #${original.seq}: ${reason}`.slice(0, 200), reversalOf: original._id,
  });
}

/**
 * Re-checks the whole chain from the first entry:
 *  1. sequence numbers have no gaps, 2. each prevHash matches the entry before, 3. each hash re-computes correctly,
 *  4. account balances follow from the entries, 5. saved checkpoints still match, 6. stored balances equal the ledger.
 * It reports the FIRST problem it finds.
 */
async function verifyChain() {
  const started = Date.now();
  const problems = [];
  let firstBadSeq = null;
  const fail = (seq, reason, detail) => { problems.push({ seq, reason, detail }); if (firstBadSeq === null && seq) firstBadSeq = seq; };

  let expectedSeq = 1; let prevHash = GENESIS; let checked = 0;
  const balances = new Map(); const hashBySeq = new Map();
  const cursor = LedgerEntry.find().sort({ seq: 1 }).lean().cursor();
  let stop = false;
  for await (const e of cursor) {
    checked += 1;
    hashBySeq.set(e.seq, e.hash);
    if (e.seq !== expectedSeq) { fail(expectedSeq, 'sequence_gap', `expected #${expectedSeq} but found #${e.seq}`); stop = true; }
    if (!stop && e.prevHash !== prevHash) { fail(e.seq, 'broken_link', 'previous hash does not match the entry before it'); stop = true; }
    if (!stop && computeHash(e) !== e.hash) { fail(e.seq, 'hash_mismatch', 'the stored hash does not match the entry contents'); stop = true; }
    if (!stop && e.account) {
      const key = String(e.account);
      const before = balances.has(key) ? balances.get(key) : 0;
      if (e.balanceAfterPaisa !== before + e.deltaPaisa) { fail(e.seq, 'balance_mismatch', 'running balance does not follow from the entries'); stop = true; }
      balances.set(key, e.balanceAfterPaisa);
    }
    if (stop) break;
    prevHash = e.hash; expectedSeq += 1;
  }
  const lastSeq = expectedSeq - 1;

  const checkpoints = await IntegrityCheckpoint.find().sort({ upToSeq: 1 }).lean();
  for (const c of checkpoints) {
    if (firstBadSeq !== null && c.upToSeq >= firstBadSeq) continue; // already failing earlier
    if (c.upToSeq > lastSeq) fail(c.upToSeq, 'entries_missing', `a checkpoint covers #${c.upToSeq} but the ledger ends at #${lastSeq}`);
    else if (hashBySeq.get(c.upToSeq) !== c.hash) fail(c.upToSeq, 'checkpoint_mismatch', `the hash at #${c.upToSeq} differs from the saved checkpoint`);
  }

  if (!problems.length) {
    const accounts = await SavingsAccount.find().lean();
    for (const a of accounts) {
      const fromLedger = balances.get(String(a._id)) || 0;
      if (a.balancePaisa !== fromLedger) fail(null, 'account_balance_mismatch', `${a.accountNo}: stored balance differs from the ledger`);
    }
  }
  return {
    ok: problems.length === 0, entriesChecked: checked, lastSeq, checkpointsChecked: checkpoints.length,
    firstBadSeq, problems, durationMs: Date.now() - started, checkedAt: new Date(),
  };
}

async function createCheckpoint(userId = null) {
  const last = await LedgerEntry.findOne().sort({ seq: -1 }).lean();
  if (!last) throw new AppError(409, 'LEDGER_EMPTY', 'There are no ledger entries yet');
  const latest = await IntegrityCheckpoint.findOne().sort({ upToSeq: -1 }).lean();
  if (latest && latest.upToSeq === last.seq) return { checkpoint: latest, created: false };
  const checkpoint = await IntegrityCheckpoint.create({ upToSeq: last.seq, hash: last.hash, createdBy: userId });
  return { checkpoint, created: true };
}

module.exports = {
  GENESIS, canonical, computeHash, deposit, withdraw, postInterest, postDisbursement, postRepayment, reverse, verifyChain, createCheckpoint,
};
