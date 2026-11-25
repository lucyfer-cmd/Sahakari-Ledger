const mongoose = require('mongoose');
const jsonId = require('./_json');

// Append-only by convention: the application only ever creates AuditLog documents.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorEmail: { type: String, default: null },
    action: { type: String, required: true, index: true },
    entityType: { type: String, default: null },
    entityId: { type: String, default: null },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditLogSchema.index({ createdAt: -1 });
jsonId(auditLogSchema);

module.exports = mongoose.model('AuditLog', auditLogSchema);
