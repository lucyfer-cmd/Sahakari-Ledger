const router = require('express').Router();
const { body, id, page, dateQuery } = require('../middleware/validators');
const { query } = require('express-validator');
const c = require('../controllers/ledger.controller');
const authenticate = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../constants/roles');
const { TYPES } = require('../models/LedgerEntry');

router.use(authenticate());
router.get('/', requirePermission(P.LEDGER_READ),
  [...page, query('type').optional().isIn(TYPES), query('account').optional().isMongoId(), dateQuery('from'), dateQuery('to')], validate, c.list);
router.post('/verify', requirePermission(P.LEDGER_VERIFY), c.verify);
router.get('/checkpoints', requirePermission(P.LEDGER_READ), c.listCheckpoints);
router.post('/checkpoints', requirePermission(P.LEDGER_VERIFY), c.createCheckpoint);
router.post('/:id/reverse', requirePermission(P.TXN_REVERSE),
  [id(), body('reason').isString().trim().isLength({ min: 3, max: 150 }).withMessage('Give a reason (3 to 150 characters)')], validate, c.reverse);

module.exports = router;
