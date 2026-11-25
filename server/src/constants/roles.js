/**
 * Roles and permissions: the single source of truth for authorization.
 * The API enforces these on every request. The client only uses them to hide buttons.
 */
const ROLES = Object.freeze({
  ADMIN: 'admin',
  TELLER: 'teller',
  MEMBER: 'member',
  AUDITOR: 'auditor',
});

const PERMISSIONS = Object.freeze({
  // Users and accounts
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE_ROLE: 'user:update-role',
  USER_UPDATE_STATUS: 'user:update-status',
  USER_APPROVE_MEMBER: 'user:approve-member',
  PROFILE_MANAGE_OWN: 'profile:manage-own',

  // Members
  MEMBER_CREATE: 'member:create',
  MEMBER_READ: 'member:read',
  MEMBER_UPDATE: 'member:update',

  // Savings accounts and transactions
  ACCOUNT_OPEN: 'account:open',
  ACCOUNT_READ: 'account:read',
  ACCOUNT_READ_OWN: 'account:read-own',
  TXN_DEPOSIT: 'transaction:deposit',
  TXN_WITHDRAW: 'transaction:withdraw',
  TXN_REVERSE: 'transaction:reverse',

  // Loans
  LOAN_APPLY: 'loan:apply',
  LOAN_READ: 'loan:read',
  LOAN_READ_OWN: 'loan:read-own',
  LOAN_APPROVE: 'loan:approve',
  LOAN_DISBURSE: 'loan:disburse',
  LOAN_COLLECT: 'loan:collect',

  // Configuration
  RATE_MANAGE: 'rate:manage',

  // Ledger, audit and reports
  LEDGER_READ: 'ledger:read',
  LEDGER_VERIFY: 'ledger:verify',
  AUDIT_READ: 'audit:read',
  REPORT_VIEW: 'report:view',
  REPORT_EXPORT: 'report:export',
});

const P = PERMISSIONS;

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: [
    P.USER_CREATE, P.USER_READ, P.USER_UPDATE_ROLE, P.USER_UPDATE_STATUS, P.USER_APPROVE_MEMBER, P.PROFILE_MANAGE_OWN,
    P.MEMBER_READ,
    P.ACCOUNT_READ,
    P.TXN_REVERSE,
    P.LOAN_READ, P.LOAN_APPROVE, P.LOAN_DISBURSE,
    P.RATE_MANAGE,
    P.LEDGER_READ,
    P.AUDIT_READ,
    P.REPORT_VIEW, P.REPORT_EXPORT,
  ],
  [ROLES.TELLER]: [
    P.USER_READ, P.USER_APPROVE_MEMBER, P.PROFILE_MANAGE_OWN,
    P.MEMBER_CREATE, P.MEMBER_READ, P.MEMBER_UPDATE,
    P.ACCOUNT_OPEN, P.ACCOUNT_READ,
    P.TXN_DEPOSIT, P.TXN_WITHDRAW,
    P.LOAN_READ, P.LOAN_COLLECT,
    P.REPORT_VIEW,
  ],
  [ROLES.MEMBER]: [
    P.PROFILE_MANAGE_OWN,
    P.ACCOUNT_READ_OWN,
    P.LOAN_APPLY, P.LOAN_READ_OWN,
  ],
  [ROLES.AUDITOR]: [
    P.PROFILE_MANAGE_OWN,
    P.MEMBER_READ, P.ACCOUNT_READ, P.LOAN_READ,
    P.LEDGER_READ, P.LEDGER_VERIFY,
    P.AUDIT_READ,
    P.REPORT_VIEW, P.REPORT_EXPORT,
  ],
});

const permissionsFor = (role) => (ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : []);
const hasPermission = (role, permission) => (ROLE_PERMISSIONS[role] || []).includes(permission);

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, permissionsFor, hasPermission };
