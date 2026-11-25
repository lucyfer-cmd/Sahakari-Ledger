const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Turns express-validator results into a uniform 400 response.
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid', details));
};
