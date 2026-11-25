const router = require('express').Router();
const { body, param, query } = require('express-validator');
const c = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P, ROLES } = require('../constants/roles');

const idParam = param('id').isMongoId().withMessage('Invalid user id');

router.use(authenticate());

router.get(
  '/',
  requirePermission(P.USER_READ),
  [query('status').optional().isIn(['pending', 'active', 'suspended']), query('role').optional().isIn(Object.values(ROLES))],
  validate,
  c.listUsers
);

router.post(
  '/',
  requirePermission(P.USER_CREATE),
  [
    body('fullName').isString().trim().isLength({ min: 2, max: 120 }),
    body('email').isString().trim().toLowerCase().isEmail(),
    body('phone').optional({ values: 'falsy' }).isString().trim().matches(/^[0-9+\-\s]{7,20}$/),
    body('role').isIn([ROLES.ADMIN, ROLES.TELLER, ROLES.AUDITOR]).withMessage('Staff role must be admin, teller or auditor'),
    body('temporaryPassword').isString().isLength({ min: 1, max: 128 }),
  ],
  validate,
  c.createStaff
);

router.patch('/:id/approve', requirePermission(P.USER_APPROVE_MEMBER), [idParam], validate, c.approveMember);
router.patch('/:id/role', requirePermission(P.USER_UPDATE_ROLE), [idParam, body('role').isIn(Object.values(ROLES))], validate, c.updateRole);
router.patch('/:id/status', requirePermission(P.USER_UPDATE_STATUS), [idParam, body('status').isIn(['active', 'suspended'])], validate, c.updateStatus);

module.exports = router;
