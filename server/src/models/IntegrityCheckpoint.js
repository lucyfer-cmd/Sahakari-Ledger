const mongoose = require('mongoose');
const jsonId = require('./_json');

// A saved copy of "the last hash at sequence N". If someone later rewrites history and re-computes the
// whole chain, the hash at N will no longer match this checkpoint.
const checkpointSchema = new mongoose.Schema({
  upToSeq: { type: Number, required: true },
  hash: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = system
  createdAt: { type: Date, default: Date.now },
});
jsonId(checkpointSchema);

module.exports = mongoose.model('IntegrityCheckpoint', checkpointSchema);
