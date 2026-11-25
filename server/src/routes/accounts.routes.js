const router = require('express').Router();
const { body, id, money, dateQuery } = require('../middleware/validators');
const { query } = require('express-validator');
const c = require('../controllers/accounts.controller');
const authenticate = require('../middleware/authenticate');
const { requirePermission, requireAnyPermission } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../constants/roles');

const memo = body('memo').optional({ values: 'falsy' }).isString().trim().isLength({ max: 200 });

router.use(authenticate());
router.post('/', requirePermission(P.ACCOUNT_OPEN), [body('memberId').isMongoId().withMessage('Choose a member')], validate, c.open);
router.get('/', requirePermission(P.ACCOUNT_READ), [query('memberId').optional().isMongoId(), query('status').optional().isIn(['active', 'closed'])], validate, c.list);
router.get('/mine', requirePermission(P.ACCOUNT_READ_OWN), c.mine);
router.get('/:id', requireAnyPermission(P.ACCOUNT_READ, P.ACCOUNT_READ_OWN), [id()], validate, c.get);
router.get('/:id/statement', requireAnyPermission(P.ACCOUNT_READ, P.ACCOUNT_READ_OWN),
  [id(), dateQuery('from'), dateQuery('to'), query('format').optional().isIn(['json', 'pdf'])], validate, c.statement);
router.post('/:id/deposit', requirePermission(P.TXN_DEPOSIT, P.ACCOUNT_READ), [id(), money(), memo], validate, c.deposit);
router.post('/:id/withdraw', requirePermission(P.TXN_WITHDRAW, P.ACCOUNT_READ), [id(), money(), memo], validate, c.withdraw);

module.exports = router;
