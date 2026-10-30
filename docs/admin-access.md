# Admin-panel access

Local setup and tests use an isolated database and never change production
accounts, passwords, firewall, TLS settings or bot tokens.

## Start locally

From the repository root, in separate terminals:

1. `npm --prefix backend ci --ignore-scripts`
2. `npm --prefix backend run dev:local`
3. `npm --prefix backend run auth:bootstrap`
4. `npm --prefix frontend ci` then `npm --prefix frontend start`
5. Open `http://localhost:3000`.

The local runner binds the backend to `127.0.0.1:3001` and starts a persistent,
isolated MongoDB 7 on `127.0.0.1:27019`, database `tg_const_admin_local`.
It downloads MongoDB on first use and saves data and a random session secret in
ignored `backend/.local-data/`. It does not use production database credentials.
No production bot records are imported. Stop the runner with Ctrl+C.

Bootstrap asks for your own login (username or email), name and password. Password input is hidden.
There is no default password, public registration or HTTP bootstrap endpoint.
Bootstrap refuses to run again when any account exists. Normal account creation
is available to a superadmin in “Користувачі та доступ”.

If using your own local MongoDB instead, copy `backend/.env.example` to `.env`
in `backend/`, fill in a random `AUTH_SESSION_SECRET` (32+ characters), and run
`npm --prefix backend start`. Set the same explicit `MONGO_URI` in the bootstrap
terminal. The isolated local runner ignores `.env` database settings.

## Roles and lifecycle

- **Admin:** all existing bot-management, statistics, voucher and giveaway actions.
- **Superadmin:** the same actions plus account creation, role changes, access
  revocation/restoration and password reset.
- New accounts and password resets require a personal password on first login.
- Revocation, role changes and password changes invalidate existing sessions.
  Restoring an account never reactivates an old cookie.
- Self-revocation and self-demotion are rejected. The last active superadmin
  cannot be disabled/demoted. Account mutations are serialized in the current
  single backend process, and the actor is checked again inside that queue.
- Password change preserves the current login with a fresh session and ends
  other logins. Idle pages recheck access every 30 seconds and on focus;
  every API request checks current account state immediately.
- Revocation stops subsequent HTTP requests. It does not cancel an operation
  already accepted by the backend (such as a running loyalty check).

## Security boundary

Express session cookies are HttpOnly, SameSite=Lax, host-only, valid for eight
hours. Session data is stored in MongoDB, and login regenerates the session ID.
There are no bearer tokens in localStorage/sessionStorage. Passwords use Node's
scrypt with a random salt and constant-time comparison. Public account responses
never include password hashes or session versions.

All existing and future `/api` routes are authenticated except login and the
read-only health probe. `/uploads` also requires a session. This boundary runs
before legacy handlers and file-upload parsers. Cookie-authenticated mutations
require the session CSRF token, a custom header and an explicitly allowed Origin.
Login is rate-limited and has generic failure messages. The frontend routes
existing fetch calls through a common cookie/CSRF client, including CSV and media.

| Endpoint | Access |
| --- | --- |
| `POST /api/auth/login` | Public, allowed Origin/custom header, throttled |
| `GET /api/auth/me` | Signed in, also allowed before temporary-password change |
| `POST /api/auth/logout` | Signed in + CSRF |
| `POST /api/auth/password` | Signed in + current password + CSRF |
| `GET /api/admin-users` | Superadmin |
| `POST /api/admin-users` | Superadmin + CSRF |
| `PATCH /api/admin-users/:id` | Superadmin + CSRF; role/isActive only |
| `POST /api/admin-users/:id/reset-password` | Superadmin + CSRF |

## Validation and deployment

`npm --prefix backend test` runs against disposable local MongoDB with fake bot
data; it does not import server startup or call Telegram/production. The new auth
suite exercises the same middleware boundary as the real server, persisted
sessions, revocation, roles, password lifecycle, CSRF, expiry and failures.
`npm --prefix frontend test -- --watchAll=false --runInBand` covers UI and the
shared API client. `npm --prefix frontend run build` builds the frontend.

Production Compose reads ignored `backend/.auth.env`. Create it with mode 600
and a stable random `AUTH_SESSION_SECRET` (32+ characters). Never print or commit
that file. Set `AUTH_TRUST_PROXY=loopback,172.18.0.0/16` for the current Docker
network, verifying that subnet before changing the deployment. Proxy headers
from public clients are not trusted. Both nginx configurations proxy `/uploads`
through Express authorization; the public port 80 also serves the current UI.

The initial authorized deployment retains the existing HTTP entrypoints and
explicitly sets `AUTH_COOKIE_SECURE=false` for compatibility. This does not
encrypt passwords or sessions in transit. Once HTTPS is configured, change it
to `true`, update allowed origins/API URLs and redirect HTTP to HTTPS.
Closing direct MongoDB ports and configuring TLS remain a separate stage.
If running multiple backend workers/replicas, replace the in-process account
mutation queue with a database transaction/shared lock before scaling. Existing
bot token fields remain accessible to authenticated admins, preserving current
editing behavior; removing those fields is a separate change.
