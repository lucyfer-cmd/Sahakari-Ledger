# Demo script (about 10 minutes)

Use `npm run seed:demo` on a fresh database first. Password for all demo logins: `Demo#Ledger2026`.
Open two browser windows (or one normal and one private) so you can switch roles quickly.

## 0. The idea in one sentence
"Sahakari Ledger records every money movement in a chain of sealed entries, so if anyone edits history, the system can show exactly where."

## 1. Member registration and approval (2 min)
1. As **teller** (`teller@example.com`): Members, **Register a member**. Note the membership number (for example `M-0006`).
2. In a private window open `/register`. Register with that membership number and the same phone number. Show the password checklist.
3. Try to sign in: it says the account is waiting for approval.
4. As teller: Users, filter **Pending approval**, **Approve**. Now the member can sign in.
5. *Say:* only real members can register, and a second person approves.

## 2. Savings (2 min)
1. As teller: open the member, **Open savings account**, then **Deposit** Rs 50,000.
2. Try to **Withdraw** more than the balance: it is refused.
3. As the member: **My accounts**, show the statement and **Download PDF**.

## 3. A loan from start to finish (3 min)
1. As the **member**: Loans, **Apply for a loan**. Show the limit (5 times savings) and the estimated instalment.
2. As **admin** (`demoadmin@example.com`): Loans, open the application. Explain the **risk score** and its four factors. **Approve**, then **Disburse**.
3. Show the **repayment schedule** and the money in the member's account.
4. As **teller**: **Collect payment** for the first instalment. The schedule updates.
5. *Say:* the teller handles money, the admin approves loans. Nobody can do both.

## 4. The tamper demo (3 min), the highlight
1. As **auditor** (`auditor@example.com`): Ledger, **Verify integrity now**. It shows **Chain intact**.
2. In a terminal, simulate a dishonest person editing the database directly:
   ```bash
   cd server
   npm run demo:tamper        # adds Rs 1,000 to one entry, bypassing the application
   ```
3. Back in the app, press **Verify integrity now** again. It reports the **exact entry number** and says the hash does not match.
4. Undo it: `npm run demo:restore`, then verify again to show it is intact.
5. *Say:* an edited amount, a deleted entry or a rewritten history all fail the check. The tests cover each case.

## 5. Control and reporting (1 min)
- As admin: **Audit log** shows who did what. **Reports** shows totals, the overdue list and downloads.
- As teller: the Ledger page is not in the menu, and typing `/ledger` in the address bar shows "Not allowed". The app hides what you cannot do, and the server refuses it even if you call the API directly.

## Questions to be ready for
| Question | Short answer |
|---|---|
| Why a hash chain? | Each entry includes the previous hash, so editing one entry breaks every later link. It makes tampering visible. |
| Can an attacker with database access fix the hashes? | Not without the secret, which is not in the database. Daily checkpoints also catch a full rewrite. It detects tampering rather than preventing it. |
| Why integer paisa? | Floating-point numbers cannot represent amounts like 0.1 exactly. |
| Why permissions instead of role checks? | One place (`roles.js`) controls access, and it is tested. |
| How is the EMI calculated? | `P*r*(1+r)^n / ((1+r)^n - 1)`; the last instalment clears rounding. Rs 100,000 at 12% for 12 months is Rs 8,884.88. |
| Is the risk score AI? | No. It is a weighted formula so every decision can be explained. |
| What would you improve? | Database transactions for several servers, daily-average interest, SMS reminders, two-factor login. |
