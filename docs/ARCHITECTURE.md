# Architecture and how it works

## 1. Overview

```
React app (Vite)  --HTTPS + JWT-->  Express API  --Mongoose-->  MongoDB
  pages, forms                      auth, permissions,          Users, Members, Accounts, LedgerEntries,
  AD/BS dates                       services, jobs, PDF         Loans, Installments, AuditLogs, ...
```

The API is organised in layers: **routes** (URLs and input validation) call **controllers** (one function per action),
which use **services** (ledger, risk score, jobs, PDF) and **models** (database shapes). Money rules live in services so
they are tested without a web server.

## 2. Money

All money is stored as **integer paisa** (Rs 1 = 100 paisa). Floating-point numbers are never used for amounts, so `0.1 + 0.2`
style errors cannot happen. The API accepts rupees with at most two decimals and converts them.

## 3. The ledger and the hash chain

Every deposit, withdrawal, interest payment, loan disbursement, loan repayment and reversal is one **ledger entry**.

```
Entry #41: [seq, prevHash = hash of #40, type, amount, effect on balance, account, loan, balance after, who, time, note]
           hash = HMAC-SHA256( secret, all of the fields above )
```

- **Chained:** each entry contains the hash of the one before it, so changing any old entry changes its hash and breaks the link to every later entry.
- **Keyed:** the hash is an HMAC with `LEDGER_HMAC_SECRET`, which is kept outside the database. Someone who only has database access cannot compute valid hashes.
- **Append-only:** the application only ever creates entries. A mistake is corrected with a **reversal**, a new entry that does the opposite.
- **One at a time:** money movements are serialised (a lock plus a unique sequence number), so concurrent deposits never fork the chain. The tests post 20 deposits at once.

### The integrity check (`POST /api/ledger/verify`)

It reads every entry in order and checks:
1. sequence numbers have no gaps;
2. each `prevHash` equals the hash of the entry before;
3. each hash re-computes correctly;
4. each account's running balance follows from the entries;
5. saved **checkpoints** still match;
6. each stored account balance equals what the ledger says.

It reports the **first** problem (entry number and reason).

### Checkpoints

A checkpoint stores "the hash at entry N". The system saves one every day and auditors can save more. If an attacker who knows
the secret rewrites old entries and re-computes every later hash, the chain would look consistent, but the hash at N would no longer
match the checkpoint, so the rewrite is still detected.

### What it can and cannot do

It **detects** tampering. It does not prevent someone with full control of both the database and the secret from rewriting history and
deleting the checkpoints too. That is why the secret is kept out of the database and why checkpoints are best copied somewhere else
(for example emailed or exported by the auditor). This limit is stated openly because it is a normal property of hash chains.

## 4. Loans

1. **Apply:** the member's savings must cover the limit (loan at most 5 times savings), amount at least Rs 1,000, 3 to 60 months, one open loan at a time.
2. **Risk score:** four factors, each from 0 to 1, multiplied by a weight:

   | Factor | Weight | Value |
   |---|---|---|
   | Repayment history | 35 | share of past instalments paid (new borrowers get 0.6) |
   | Savings compared with the loan | 25 | savings balance divided by loan amount, at most 1 |
   | Time as a member | 20 | months divided by 24, at most 1 |
   | Nothing overdue | 20 | 1 if nothing overdue, lower for each overdue instalment |

   Score 70 or more is low risk, 40 to 69 medium, below 40 high. It is a **formula you can explain**, not machine learning.
3. **Approve or reject:** approval fixes the interest rate for that loan (later rate changes do not affect it).
4. **Disburse:** the money is added to the member's savings account, the repayment schedule is created and the entry goes into the ledger.
5. **Repay:** a teller records cash received. It clears the oldest unpaid instalments first. When nothing is left the loan closes.

**EMI formula (reducing balance):** `EMI = P * r * (1+r)^n / ((1+r)^n - 1)` where `r` = annual rate / 12 and `n` = months.
Each month's interest is the outstanding balance times `r`. The last instalment clears any rounding difference, so the loan always ends at exactly zero.
Hand-checked value used in the tests: Rs 100,000 at 12% for 12 months gives Rs 8,884.88.

## 5. Scheduled jobs

Run once at start-up and every 24 hours (and on demand by an admin at `POST /api/jobs/run`). All are safe to run repeatedly.

| Job | What it does |
|---|---|
| Overdue marking | Instalments past their due date and not fully paid become `overdue` |
| Reminders | Notifies members 3 days before a due date and when an instalment is overdue (once each) |
| Monthly interest | Posts last month's savings interest, at most once per account per month |
| Checkpoint | Saves an integrity checkpoint |

## 6. Security model (summary)

Details are in `docs/Auth_Design.docx`.

- Passwords: bcrypt, strong-password rules, lockout after 5 wrong tries.
- Sessions: 15-minute access token in memory, rotating refresh token in an `httpOnly` cookie, reuse detection.
- Authorization: roles are lists of **permissions** (`server/src/constants/roles.js`). Every route checks one. The browser only hides buttons.
- Members see only their own data: the server uses the signed-in user, never an id sent from the browser.
- Input validation on every route, NoSQL operator stripping, rate limiting, helmet security headers, CSV formula protection.
- Audit log for logins, approvals, role changes, loan decisions, ledger checks, rate changes and exports. It never records passwords.

## 7. Known limitations

- **One server instance:** money movements are serialised inside one process. To run several servers, use MongoDB transactions (a replica set).
- **Interest** uses the current balance, not the daily average balance a real cooperative might use.
- **Loan repayments** are cash only. Paying from the savings account is a possible extension.
- **Email** for password resets needs SMTP settings; without them the link is printed in the server console.
- Not included: two-factor authentication, email verification, a breached-password list, a Nepali-language interface.
- The end-to-end tests were run on a MongoDB-compatible database. Run them once on your own MongoDB as well.
- Not load tested. Intended for the size of a small cooperative.
