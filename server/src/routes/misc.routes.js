const express = require('express');
const { body, id, page, dateQuery } = require('../middleware/validators');
const { query, param } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../constants/roles');
const rates = require('../controllers/rates.controller');
const notifications = require('../controllers/notifications.controller');
const audit = require('../controllers/audit.controller');
const reports = require('../controllers/reports.controller');
const dashboard = require('../controllers/dashboard.controller');
const jobs = require('../controllers/jobs.controller');

const router = (fn) => { const r = express.Router(); r.use(authenticate()); fn(r); return r; };

exports.rates = router((r) => {
  r.get('/', rates.list);
  r.post('/', requirePermission(P.RATE_MANAGE),
    [body('product').isIn(['savings', 'loan']), body('ratePct').isFloat({ min: 0, max: 100 }).withMessage('Rate must be between 0 and 100').toFloat(),
      body('effectiveFrom').optional({ values: 'falsy' }).isISO8601()], validate, rates.create);
});
exports.notifications = router((r) => {
  r.get('/', notifications.list);
  r.post('/read-all', notifications.markAllRead);
  r.post('/:id/read', [id()], validate, notifications.markRead);
});
exports.audit = router((r) => {
  r.get('/', requirePermission(P.AUDIT_READ),
    [...page, query('action').optional().isString().isLength({ max: 60 }), query('actor').optional().isString().isLength({ max: 80 }),
      query('outcome').optional().isIn(['success', 'failure']), dateQuery('from'), dateQuery('to')], validate, audit.list);
});
exports.reports = router((r) => {
  const month = query('month').optional().matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('Month must look like 2026-11');
  r.get('/summary', requirePermission(P.REPORT_VIEW), reports.summary);
  r.get('/monthly', requirePermission(P.REPORT_VIEW), [month, query('format').optional().isIn(['json', 'pdf'])], validate, reports.monthly);
  r.get('/defaulters', requirePermission(P.REPORT_VIEW), reports.defaulters);
  r.get('/export/:kind', requirePermission(P.REPORT_EXPORT), [param('kind').isIn(['members', 'ledger', 'defaulters', 'monthly']), month], validate, reports.exportCsv);
});
exports.dashboard = router((r) => { r.get('/', dashboard.get); });
exports.jobs = router((r) => { r.post('/run', requirePermission(P.RATE_MANAGE), jobs.run); });
