# Loyalty checks

Manual checks only start from an explicit POST. GET requests never allocate
vouchers. No bulk recovery or manual check runs on deployment or restart.
The existing automatic checker continues running while bots are active.

- `POST /api/force-give-loyalty-rewards-all/:botId` returns `202` and a job.
- `GET /api/loyalty-check/:botId` reads the latest job, including after reopening
  the dialog. Counts distinguish checked users, newly assigned vouchers,
  existing assignments, missing stock, skipped users, and errors.
- `POST /api/loyalty-check/:botId/cancel` stops before the next user.
- `GET /api/loyalty-auto-progress/:botId` reads the automatic cycle's progress.
- Legacy period/fix endpoints use the same background worker. Only one manual
  job per bot may run at a time; repeating POST returns the running job.

Interrupted manual jobs stay interrupted after a restart. An administrator may
explicitly start again. Existing assigned vouchers prevent duplicate rewards.
Assignments are atomic, protected by a sparse unique allocation key, and reward
flags are synchronized afterward. A failed flag write can safely be retried.
Historical flags alone never count as a voucher, and empty stock remains retryable.
No notification messages are sent by the checker.

Automatic checks use batches of 50 every five seconds, without overlap, and
keyset pagination with a snapshot boundary. A cycle is not a promise of immediate
delivery: duration depends on user count and Telegram response time.

## Local validation

`npm --prefix backend ci --ignore-scripts` and `npm --prefix backend test` run the integration
suite against a temporary local MongoDB 7 instance. Telegram responses are mocked;
tests do not connect to production or send messages. On first use,
mongodb-memory-server downloads its test binary.

`npm --prefix frontend ci`, then `npm --prefix frontend test -- --watchAll=false
--runInBand` run the UI tests; `npm --prefix frontend run build` builds production
assets. Browser testing uses a local mock API, never the production award endpoints.

## Deployment

Keep the previous backend/frontend image tags for rollback. Deploy the same
commit and built frontend assets that passed tests. Preserve runtime JSON files,
uploads, promocodes, and MongoDB volumes. Verify health, polling count, the read-only
progress APIs, and image revision labels. Do not run a manual check as a smoke test.
