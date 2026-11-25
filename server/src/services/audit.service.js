const AuditLog = require('../models/AuditLog');

/** Writes an audit record. It never throws: a logging failure must not break the user's request. */
async function audit(req, { action, actor = null, actorEmail = null, entityType = null, entityId = null, outcome = 'success', meta = {} }) {
  try {
    await AuditLog.create({
      actor: actor ? actor._id || actor : null,
      actorEmail: actorEmail || (actor && actor.email) || null,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      outcome,
      ip: req ? req.ip : null,
      userAgent: req ? (req.get('user-agent') || '').slice(0, 300) : null,
      meta,
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { audit };
