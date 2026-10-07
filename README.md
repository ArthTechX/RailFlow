# RailFlow 🚆

A TypeScript railway reservation backend with independently runnable Express services, PostgreSQL/Prisma, Redis locks and caching, Elasticsearch fuzzy search, BullMQ jobs, Google OAuth, and extensible payments.

## Deployable full-stack portfolio

The deployable app is in [portfolio/](portfolio/). It serves the interface and backend APIs, stores bookings in SQL, and simulates payments/refunds without OAuth or gateway credentials. Start it with `cd portfolio && npm ci && npm run dev`, then open http://localhost:3006. See [portfolio/README.md](portfolio/README.md) for architecture, tests, and deployment.

## Browser demo (recommended for presentations)

Run a complete local prototype with no Docker, database, OAuth, or payment configuration:

```sh
cd /Users/ujjawalkumar/Documents/ChatGPT/RailFlow
npm run demo
```

Open http://localhost:3005. Requires only Node.js 22+; the demo server uses built-in Node modules and does not need npm dependencies. Search sample routes, choose a travel class, add passengers, simulate success or failure, view a demo ticket, and cancel for a simulated refund. Bookings persist in your browser. Use **Reset demo** to clear them.

For partial allocation, book the first Delhi → Mumbai train in **2A** with **three passengers**: two receive seats and one is waitlisted. The built-in **Demo guide** explains a presentation walkthrough. All schedules, inventory, prices, payments, and refunds are simulated. The demo is independent of the backend services below.

## Quick start

Requires Node.js 22+, npm, and Docker with Compose. Google credentials are needed for interactive login. The default payment provider is a local simulation: it never charges real money.

```sh
npm ci
cp .env.example .env
```

Set three different random secrets in `.env`: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `PAYMENT_WEBHOOK_SECRET` (32+ characters each). For example, generate each separately with `openssl rand -hex 32`. Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and register the callback `http://localhost:3000/auth/google/callback` in Google Cloud.

```sh
docker compose up --build -d
docker compose exec gateway node dist/prisma/seed.js
```

The migration container applies the committed schema before services start. Seed creates 24 seats and Delhi → Mumbai departures for the next 30 days, and indexes stations and trains in Elasticsearch. Seed can be rerun safely.

- API: http://localhost:3000
- Health: http://localhost:3000/health (process liveness, not dependency readiness)
- Captured email: http://localhost:8025

The microservice API is separate from the browser demo. Use an API client or the examples below to test the backend. Ports for infrastructure and the gateway bind to localhost; service containers are only exposed on the Compose network. Compose is a local development configuration, with default database credentials and Elasticsearch authentication disabled.

### Run services on the host

```sh
docker compose up -d postgres redis elasticsearch mailpit
npm run db:generate
npm run db:migrate
npm run db:seed
```

Set `SMTP_HOST=localhost` in `.env` to deliver host-worker emails to Mailpit. In separate terminals:

```sh
npm run dev:services
npm run dev
```

Gateway uses ports 3001–3004 for auth, search, booking, and payment services; it listens on 3000. The worker has no HTTP port. Override gateway targets with `AUTH_URL`, `SEARCH_URL`, `BOOKING_URL`, and `PAYMENT_URL` when deploying services independently. Each HTTP service can use `PORT`.

## API walkthrough

Open `/auth/google` in a browser. The callback returns `{accessToken, refreshToken, expiresIn}`. Access tokens last 15 minutes; refresh tokens last seven days and rotate on every refresh. Store tokens securely in your client; the backend does not include a client token-storage implementation. Refresh and logout accept `{ "refreshToken": "..." }`. Logout revokes the refresh session; existing access tokens remain valid until their short expiration.

```sh
curl 'http://localhost:3000/stations/search?q=Delih'
curl 'http://localhost:3000/trains/search?source=Delhi&destination=Mumbai&date=2026-10-20'
```

Use a date within the next 30 days after seeding. Journey dates are interpreted in India Standard Time. Search returns journey IDs. `q` optionally fuzzy-filters train name or number. Elasticsearch failure falls back to database substring matching (the fallback does not correct typos). Search results are cached for 60 seconds; availability is read directly from PostgreSQL.

```sh
curl 'http://localhost:3000/trains/TRAIN_ID/availability?journeyId=JOURNEY_ID'
curl -X POST http://localhost:3000/bookings \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: reservation-001' \
  -d '{"journeyId":"JOURNEY_ID","passengers":[{"name":"Rahul Kumar","age":22},{"name":"Aman Kumar","age":24}]}'
```

Use a distinct idempotency key for each intended booking. Retry the same payload and key after a network error or a 409 journey-busy response, with backoff. Reusing a key with changed data returns 409. Requests support 1–6 passengers aged 1–120. Available passengers get held seats; overflow passengers are waitlisted. Only allocated seats are charged, in integer paise, and a request with no available seat returns 409. Passenger `CONFIRMED` means seat allocated; the parent booking remains `PENDING` until payment. Seats are held for `HOLD_MINUTES` (default 15).

```sh
curl -X POST http://localhost:3000/payments/create \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"bookingId":"BOOKING_ID"}'
```

For a mock payment, simulate a provider event using `scripts/mock-payment.mjs` (reads `.env`):

```sh
node --env-file=.env scripts/mock-payment.mjs PAYMENT_ID
# failure:
node --env-file=.env scripts/mock-payment.mjs PAYMENT_ID failed
```

This signs the exact JSON bytes with `PAYMENT_WEBHOOK_SECRET`. The webhook records event IDs transactionally, so replay does not repeat confirmation or refund events. The secret is server-side only; do not ship it in clients.

```sh
curl http://localhost:3000/users/me/bookings -H "Authorization: Bearer $ACCESS_TOKEN"
curl -X POST http://localhost:3000/bookings/BOOKING_ID/cancel -H "Authorization: Bearer $ACCESS_TOKEN"
```

Cancellation releases seats immediately. A paid booking moves to `CANCELLED`, then `REFUNDED` when the worker completes a full refund. Unpaid cancellation remains `CANCELLED`. Cancellation after departure returns 409. A late successful payment on an expired, cancelled, or previously failed booking schedules a refund instead of allocating seats again.

### Endpoints

| Method | Path | Authentication |
| --- | --- | --- |
| GET | `/health` | Public |
| GET | `/auth/google`, `/auth/google/callback` | Public OAuth flow |
| POST | `/auth/refresh`, `/auth/logout` | Refresh token in body |
| GET | `/auth/me` | Access token |
| GET | `/stations/search?q=...` | Public |
| GET | `/trains/search?source=...&destination=...&date=YYYY-MM-DD&q=...` | Public |
| GET | `/trains/:trainId` | Public |
| GET | `/trains/:trainId/availability?journeyId=...` | Public |
| POST | `/bookings` | Access token + Idempotency-Key |
| GET | `/bookings/:bookingId`, `/users/me/bookings` | Access token |
| POST | `/bookings/:bookingId/cancel` | Access token |
| POST | `/payments/create`, `/payments/verify` | Access token, bookingId in body |
| POST | `/payments/webhook` | HMAC signature |

Errors have `{error}` and validation errors include `details`. Owned resources return 404 to other users. Lists cap at 100 results. Amounts are always integer INR paise.

## Payments and jobs

`PaymentProvider` exposes `createPayment`, `verifyPayment`, and `refundPayment`. `PAYMENT_PROVIDER` selects `mock`, `stripe`, or `razorpay`:

- **Mock:** development simulation, signed webhook required for success.
- **Stripe:** creates a Checkout Session with a hosted checkout URL; uses stable provider idempotency keys for creation and refunds. Configure `STRIPE_SECRET_KEY`. A future client should call `/payments/verify` after checkout.
- **Razorpay:** creates an order ID for a future Razorpay Checkout client. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Verification checks the order's paid amount and currency. Refund processing checks the captured payment's refunded amount before retrying.

`/payments/webhook` accepts a RailFlow-specific signed payload `{id,paymentId,success}` with `X-RailFlow-Signature` set to its HMAC-SHA256 hex digest. This is **not** a native Stripe or Razorpay webhook endpoint. For production webhooks, deploy a trusted bridge that validates the provider's native signature and emits this event, or add native routes. Real-provider success is also verified server-to-server; unverified events return 202 without freeing inventory. A worker periodically reconciles incomplete real payments against their providers.

Provider adapters are implemented but require sandbox credentials and end-to-end provider testing before accepting live money. Razorpay creation does not have Stripe-style idempotency: a crash after remote order creation and before local persistence can leave an orphan order. Reconcile orders before retrying ambiguous failures in production. Verification checks amount/currency; the client cannot assert payment success. Provider keys and the webhook secret must never be shared with the browser.

Confirmation/refund events are persisted in a transactional database outbox before being published to BullMQ. Stable job IDs deduplicate publication retries. Jobs retry with exponential backoff; completed jobs are retained so outbox replay remains deduplicated. Queue delivery and email are at least once: a crash after SMTP accepts a message may send another email. Mailpit handles local delivery; SMTP is required for confirmation jobs. Failed jobs are retained and logged for operator review. Add monitoring, retention policies, and a dead-letter recovery interface before production use.

## Consistency model

1. Acquire a 15-second Redis lease using a unique token.
2. Lock the PostgreSQL journey row with `SELECT ... FOR UPDATE` inside a transaction.
3. Check availability and claim each inventory row conditionally.
4. Commit passengers and booking together, then release the Redis lease only if still owned.

The PostgreSQL row lock is authoritative even if the Redis lease expires. Each journey/seat pair is unique, and each passenger can own one inventory row. Cancellation, payment transitions, and hold expiration take the same journey lock. Partial allocation preserves confirmed seats and waitlisted passengers in one transaction. Waitlisted passengers are not automatically promoted.

Inventory represents an entire origin-to-destination journey. Intermediate station bookings and segment-overlap seat reuse are not implemented. All seeded seats have one class and fare. This is a backend reference implementation, with shared database and shared TypeScript modules across independently runnable services; it does not claim strict database-per-service isolation.

## Verification

```sh
npm run db:generate
npm run build
npm test
```

Unit tests cover partial charging/allocation, sold-out rejection, claim conflicts, idempotency mismatch, payment state transitions, replay, late-payment refunds, HMAC tampering, and provider amount/currency validation. They use mocked persistence and do not prove database concurrency.

For the real PostgreSQL + Redis concurrency/lifecycle suite, migrate a **separate test schema**, then enable the opt-in test:

```sh
DATABASE_URL='postgresql://railflow:railflow@localhost:5432/railflow?schema=railflow_test' npm run db:migrate
DATABASE_URL='postgresql://railflow:railflow@localhost:5432/railflow?schema=railflow_test' RUN_INTEGRATION=1 npm run test:integration
```

The integration test refuses non-test schemas and creates/removes its own fixtures. It tests concurrent seat requests, request replay, payment-event replay, cancellation, and partial allocation. Redis must be running. OAuth and real payment gateway end-to-end verification require external credentials.
