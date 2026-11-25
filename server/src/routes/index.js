const router = require('express').Router();
const misc = require('./misc.routes');

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'sahakari-ledger-api' }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/members', require('./members.routes'));
router.use('/accounts', require('./accounts.routes'));
router.use('/ledger', require('./ledger.routes'));
router.use('/loans', require('./loans.routes'));
router.use('/rates', misc.rates);
router.use('/notifications', misc.notifications);
router.use('/audit', misc.audit);
router.use('/reports', misc.reports);
router.use('/dashboard', misc.dashboard);
router.use('/jobs', misc.jobs);

module.exports = router;
