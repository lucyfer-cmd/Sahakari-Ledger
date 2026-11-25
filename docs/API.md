# API reference

Base URL: `/api`. Requests and responses are JSON. Send `Authorization: Bearer <accessToken>` on every route except the public ones.
Amounts in requests are **rupees** (up to 2 decimals); amounts in responses are **paisa** (integers, fields ending in `Paisa`).

Errors always look like this:

```json
{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "Not enough balance for this withdrawal", "details": [] } }
```

Common codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED`/`TOKEN_INVALID` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `DUPLICATE` (409), `RATE_LIMITED` (429).

## Authentication (see Auth_Design.docx)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/register` | anyone | Member creates an account (pending approval) |
| POST | `/auth/login` | anyone | Sign in, returns access token, user and permissions |
| POST | `/auth/refresh` | cookie | New access token, rotates the refresh cookie |
| POST | `/auth/logout`, `/auth/logout-all` | signed in | End this session or all sessions |
| GET | `/auth/me` | signed in | Current user and permissions |
| POST | `/auth/change-password` | signed in | Change password |
| POST | `/auth/forgot-password`, `/auth/reset-password` | anyone | Password reset by email link |

## Users

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/users?status=&role=` | `user:read` | List users (a teller sees members only) |
| POST | `/users` | `user:create` | Create a staff account |
| PATCH | `/users/:id/approve` | `user:approve-member` | Approve a pending member account |
| PATCH | `/users/:id/role` | `user:update-role` | Change role |
| PATCH | `/users/:id/status` | `user:update-status` | Suspend or reactivate |

## Members

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/members` | `member:create` | Register a member (membership number is generated) |
| GET | `/members?q=&status=&page=&limit=` | `member:read` | Search and list |
| GET | `/members/:id` | `member:read` | Profile with accounts, loans and login status |
| PATCH | `/members/:id` | `member:update` | Edit details (changing `status` needs `user:update-status`) |

## Savings accounts

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/accounts` `{memberId}` | `account:open` | Open an account |
| GET | `/accounts?memberId=&status=` | `account:read` | List accounts |
| GET | `/accounts/mine` | `account:read-own` | The signed-in member's accounts |
| GET | `/accounts/:id` | `account:read` or own | One account (members only see their own) |
| GET | `/accounts/:id/statement?from=&to=&format=pdf` | `account:read` or own | Statement as JSON or PDF |
| POST | `/accounts/:id/deposit` `{amount, memo}` | `transaction:deposit` + `account:read` | Record a deposit |
| POST | `/accounts/:id/withdraw` `{amount, memo}` | `transaction:withdraw` + `account:read` | Record a withdrawal (`INSUFFICIENT_FUNDS` if too large) |

## Ledger

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/ledger?type=&account=&from=&to=&page=` | `ledger:read` | Browse entries |
| POST | `/ledger/verify` | `ledger:verify` | Run the integrity check |
| GET | `/ledger/checkpoints` | `ledger:read` | List checkpoints |
| POST | `/ledger/checkpoints` | `ledger:verify` | Save a checkpoint at the latest entry |
| POST | `/ledger/:id/reverse` `{reason}` | `transaction:reverse` | Cancel a deposit, withdrawal or interest entry with an opposite entry |

## Loans

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/loans` `{amount, termMonths, purpose}` | `loan:apply` | Member applies (risk score computed) |
| GET | `/loans?status=&memberId=&page=` | `loan:read` | List loans |
| GET | `/loans/mine` | `loan:read-own` | The member's loans |
| GET | `/loans/overdue` | `loan:read` | Overdue instalments with days late |
| GET | `/loans/:id` | `loan:read` or own | Loan, schedule and amount still due |
| POST | `/loans/:id/approve` `{note}` | `loan:approve` | Approve (fixes the rate; needs a loan rate to be set) |
| POST | `/loans/:id/reject` `{note}` | `loan:approve` | Reject with a reason |
| POST | `/loans/:id/disburse` | `loan:disburse` | Pay out, create the schedule |
| POST | `/loans/:id/repay` `{amount, memo}` | `loan:collect` | Record a cash repayment |

## Other

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/rates` | signed in | Current and past interest rates |
| POST | `/rates` `{product, ratePct, effectiveFrom}` | `rate:manage` | Set a savings or loan rate |
| GET | `/notifications` | signed in | Own notifications and unread count |
| POST | `/notifications/:id/read`, `/notifications/read-all` | signed in | Mark as read |
| GET | `/audit?action=&actor=&outcome=&from=&to=&page=` | `audit:read` | Audit log |
| GET | `/dashboard` | signed in | Numbers for the home page (depends on the role) |
| GET | `/reports/summary` | `report:view` | Totals |
| GET | `/reports/monthly?month=YYYY-MM&format=pdf` | `report:view` | Monthly summary, JSON or PDF |
| GET | `/reports/defaulters` | `report:view` | Overdue list |
| GET | `/reports/export/:kind` (`members`, `ledger`, `defaulters`, `monthly`) | `report:export` | CSV download |
| POST | `/jobs/run` | `rate:manage` | Run the daily jobs now |
| GET | `/health` | public | Health check |
