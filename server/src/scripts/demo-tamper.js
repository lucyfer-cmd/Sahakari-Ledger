// DEMO ONLY: simulates a dishonest person editing the database directly, so you can show the integrity check catching it.
//   node src/scripts/demo-tamper.js tamper [seq]   -> adds Rs 1,000 to one ledger entry, bypassing the application
//   node src/scripts/demo-tamper.js restore        -> puts the original value back
// After "tamper", sign in as the auditor and press "Verify integrity": it reports the exact entry.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../config/env');
const LedgerEntry = require('../models/LedgerEntry');

if (env.isProd) { console.error('Refusing to run in production.'); process.exit(1); }
const FILE = path.join(__dirname, '..', '..', '.tamper-backup.json');
const [action, seqArg] = process.argv.slice(2);

(async () => {
  await mongoose.connect(env.MONGO_URI);
  if (action === 'tamper') {
    const entry = seqArg ? await LedgerEntry.findOne({ seq: Number(seqArg) }) : await LedgerEntry.findOne({ type: 'deposit' }).sort({ seq: 1 }).skip(2);
    if (!entry) throw new Error('No ledger entry found. Run npm run seed:demo first.');
    fs.writeFileSync(FILE, JSON.stringify({ id: String(entry._id), seq: entry.seq, amountPaisa: entry.amountPaisa }));
    await LedgerEntry.collection.updateOne({ _id: entry._id }, { $set: { amountPaisa: entry.amountPaisa + 100000 } });
    console.log(`Entry #${entry.seq}: amount changed from Rs ${entry.amountPaisa / 100} to Rs ${(entry.amountPaisa + 100000) / 100} directly in the database.`);
    console.log('Now run "Verify integrity" as the auditor. Undo with: node src/scripts/demo-tamper.js restore');
  } else if (action === 'restore') {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    await LedgerEntry.collection.updateOne({ _id: new mongoose.Types.ObjectId(saved.id) }, { $set: { amountPaisa: saved.amountPaisa } });
    fs.unlinkSync(FILE);
    console.log(`Entry #${saved.seq} restored to Rs ${saved.amountPaisa / 100}.`);
  } else {
    console.log('Usage: node src/scripts/demo-tamper.js tamper [seq] | restore');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
