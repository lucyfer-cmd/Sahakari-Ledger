const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { verifyAccessToken } = require('../services/token.service');

/**
 * Verifies the Bearer access token, then loads the user so that suspension, role changes and
 * password changes take effect immediately (not only when the token expires).
 * Accounts flagged mustChangePassword may only use routes that pass { allowPasswordChange: true }.
 */
function authenticate({ allowPasswordChange = false } = {}) {
  return asyncHandler(async (req, res, next) => {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      throw new AppError(401, 'TOKEN_INVALID', 'Session expired or invalid');
    }

    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active' || user.tokenVersion !== payload.ver) {
      throw new AppError(401, 'TOKEN_INVALID', 'Session expired or invalid');
    }
    if (user.mustChangePassword && !allowPasswordChange) {
      throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must change your password before continuing');
    }
    req.user = user;
    next();
  });
}

module.exports = authenticate;
