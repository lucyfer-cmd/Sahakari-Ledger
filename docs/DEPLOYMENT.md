# Deployment guide

The app is one Node service plus MongoDB. The API serves the built React app, so you deploy a single service.

## 1. Database: MongoDB Atlas (free tier is enough for a demo)
1. Create a cluster at mongodb.com/atlas and a database user.
2. Allow your hosting service's IP addresses (or `0.0.0.0/0` for a demo only).
3. Copy the connection string, for example `mongodb+srv://user:password@cluster.mongodb.net/sahakari_ledger`.

## 2. Environment variables

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas connection string |
| `JWT_ACCESS_SECRET` | 32+ random characters |
| `LEDGER_HMAC_SECRET` | A **different** 32+ random characters. Store a copy safely: without it the ledger cannot be verified |
| `CLIENT_ORIGIN` | The public URL of the app, for example `https://sahakari.example.com` |
| `PORT` | Usually set by the host |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Optional, for password-reset emails |

The server refuses to start in production without both secrets.

## 3. Deploy with Docker (works on Render, Railway, Fly.io and similar)
```bash
docker build -t sahakari-ledger .
docker run -p 5000:5000 --env-file server/.env sahakari-ledger
```
Without Docker: run `npm ci && npm run build` in `client/`, then `npm ci --omit=dev && npm start` in `server/`.

## 4. First start
```bash
# one time, from a machine with the same environment variables
cd server && npm run seed
```
This creates the first admin (must change the password at first sign-in) and default interest rates. Use `seed:demo` only for demonstrations.

## 5. Checklist
- [ ] HTTPS is on (the refresh cookie is marked `Secure` in production)
- [ ] Both secrets are random, unique and not in Git
- [ ] `CLIENT_ORIGIN` matches the public URL
- [ ] SMTP is configured, or reset links are printed in the server log
- [ ] Database backups are on (Atlas does this on paid tiers; take manual exports on the free tier)
- [ ] A copy of `LEDGER_HMAC_SECRET` is stored safely
- [ ] An auditor runs **Verify integrity** regularly and exports checkpoints elsewhere
- [ ] Demo accounts and `seed:demo` data are **not** used in production

## 6. Notes
- Run **one** server instance. Money movements are serialised inside the process.
- The daily jobs run inside the server. If the host sleeps (free tiers), call `POST /api/jobs/run` as an admin, or use an external scheduler.
