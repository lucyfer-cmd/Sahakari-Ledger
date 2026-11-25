const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiters');

const email = body('email').isString().trim().toLowerCase().isEmail().withMessage('Enter a valid email').isLength({ max: 254 });
const passwordField = (name) => body(name).isString().withMessage('Password is required').isLength({ min: 1, max: 128 }).withMessage('Password must be 1-128 characters');

router.post(
  '/register',
  authLimiter,
  [
    body('fullName').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Enter your full name'),
    email,
    body('phone').isString().trim().matches(/^[0-9+\-\s]{7,20}$/).withMessage('Enter a valid phone number'),
    body('membershipNo').isString().trim().isLength({ min: 1, max: 30 }).withMessage('Enter your membership number'),
    passwordField('password'),
  ],
  validate,
  c.register
);

router.post('/login', authLimiter, [email, passwordField('password')], validate, c.login);
router.post('/refresh', c.refresh);
router.post('/logout', authenticate({ allowPasswordChange: true }), c.logout);
router.post('/logout-all', authenticate({ allowPasswordChange: true }), c.logoutAll);
router.get('/me', authenticate({ allowPasswordChange: true }), c.me);

router.post(
  '/change-password',
  authenticate({ allowPasswordChange: true }),
  [passwordField('currentPassword'), passwordField('newPassword')],
  validate,
  c.changePassword
);

router.post('/forgot-password', authLimiter, [email], validate, c.forgotPassword);
router.post(
  '/reset-password',
  authLimiter,
  [body('token').isString().isLength({ min: 20, max: 200 }).withMessage('Reset token is required'), passwordField('newPassword')],
  validate,
  c.resetPassword
);

module.exports = router;
