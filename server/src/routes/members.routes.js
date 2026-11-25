const router = require('express').Router();
const { body, id, page } = require('../middleware/validators');
const { query } = require('express-validator');
const c = require('../controllers/members.controller');
const authenticate = require('../middleware/authenticate');
const { requirePermission } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { PERMISSIONS: P } = require('../constants/roles');

const text = (f, max = 120) => body(f).optional({ values: 'falsy' }).isString().trim().isLength({ max });
const profile = [
  text('email', 254).bail().isEmail().withMessage('Enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
  body('dob').optional({ values: 'falsy' }).isISO8601().withMessage('Date of birth must be a date').toDate(),
  body('gender').optional({ values: 'falsy' }).isIn(['female', 'male', 'other']),
  text('address.ward', 40), text('address.municipality'), text('address.district'),
  text('nominee.name'), text('nominee.relation', 60), text('nominee.phone', 20),
];

router.use(authenticate());
router.post('/', requirePermission(P.MEMBER_CREATE),
  [body('fullName').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Enter the full name'),
    body('phone').isString().trim().matches(/^[0-9+\-\s]{7,20}$/).withMessage('Enter a valid phone number'), ...profile], validate, c.create);
router.get('/', requirePermission(P.MEMBER_READ),
  [...page, query('status').optional().isIn(['active', 'suspended', 'closed']), query('q').optional().isString().isLength({ max: 60 })], validate, c.list);
router.get('/:id', requirePermission(P.MEMBER_READ), [id()], validate, c.get);
router.patch('/:id', requirePermission(P.MEMBER_UPDATE),
  [id(), body('fullName').optional().isString().trim().isLength({ min: 2, max: 120 }),
    body('phone').optional().isString().trim().matches(/^[0-9+\-\s]{7,20}$/).withMessage('Enter a valid phone number'),
    body('status').optional().isIn(['active', 'suspended', 'closed']), ...profile], validate, c.update);

module.exports = router;
