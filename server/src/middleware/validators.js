const { body, param, query } = require('express-validator');

const id = (name = 'id') => param(name).isMongoId().withMessage('Invalid id');
const money = (field = 'amount') =>
  body(field)
    .isFloat({ min: 0.01, max: 1000000000 }).withMessage('Enter an amount greater than 0')
    .bail()
    .custom((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6).withMessage('Use at most 2 decimal places')
    .toFloat();
const page = [query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1, max: 100 }).toInt()];
const dateQuery = (name) => query(name).optional().isISO8601().withMessage(`${name} must be a date like 2026-11-30`);

/** Reads ?page and ?limit safely. */
const paging = (req, defLimit = 20) => {
  const limit = Math.min(req.query.limit || defLimit, 100);
  const pageNo = req.query.page || 1;
  return { limit, page: pageNo, skip: (pageNo - 1) * limit };
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { id, money, page, dateQuery, paging, escapeRegex, body, param, query };
