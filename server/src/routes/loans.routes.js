const router = require('express').Router();
const { body, id, money, page } = require('../middleware/validators');
const { query } = require('express-validator');
const c = require('../controllers/loans.controller');
const authenticate = require('../middleware/authenticate');
const { requirePermission, requireAnyPermission } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../constants/roles');
const { MIN_TERM_MONTHS, MAX_TERM_MONTHS } = require('../config/business');

router.use(authenticate());
router.post('/', requirePermission(P.LOAN_APPLY),
  [money(), body('termMonths').isInt({ min: MIN_TERM_MONTHS, max: MAX_TERM_MONTHS }).withMessage(`Term must be ${MIN_TERM_MONTHS} to ${MAX_TERM_MONTHS} months`).toInt(),
    body('purpose').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 })], validate, c.apply);
router.get('/', requirePermission(P.LOAN_READ),
  [...page, query('status').optional().isIn(['applied', 'approved', 'rejected', 'disbursed', 'closed']), query('memberId').optional().isMongoId()], validate, c.list);
router.get('/mine', requirePermission(P.LOAN_READ_OWN), c.mine);
router.get('/overdue', requirePermission(P.LOAN_READ), c.overdue);
router.get('/:id', requireAnyPermission(P.LOAN_READ, P.LOAN_READ_OWN), [id()], validate, c.get);
router.post('/:id/approve', requirePermission(P.LOAN_APPROVE), [id(), body('note').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 })], validate, c.approve);
router.post('/:id/reject', requirePermission(P.LOAN_APPROVE),
  [id(), body('note').isString().trim().isLength({ min: 3, max: 300 }).withMessage('Give a reason for rejecting')], validate, c.reject);
router.post('/:id/disburse', requirePermission(P.LOAN_DISBURSE), [id()], validate, c.disburse);
router.post('/:id/repay', requirePermission(P.LOAN_COLLECT), [id(), money(), body('memo').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 })], validate, c.repay);

module.exports = router;
