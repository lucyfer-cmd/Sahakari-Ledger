const AppError = require('../utils/AppError');
const { hasPermission } = require('../constants/roles');

/** Allows the request only if the user's role grants ALL listed permissions. Use after authenticate(). */
const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  const allowed = permissions.every((p) => hasPermission(req.user.role, p));
  if (!allowed) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do this'));
  next();
};

/** Allows the request if the user has at least one of the listed permissions. */
const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  const allowed = permissions.some((p) => hasPermission(req.user.role, p));
  if (!allowed) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do this'));
  next();
};

module.exports = { requirePermission, requireAnyPermission };
