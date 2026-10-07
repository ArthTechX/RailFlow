



# RailFlow 🚆

RailFlow is a scalable railway reservation and booking platform built using Node.js, TypeScript, Express.js, PostgreSQL, Redis, Elasticsearch, and BullMQ.

The project demonstrates backend engineering concepts such as microservices, authentication, distributed locking, concurrency-safe seat allocation, asynchronous job processing, caching, fuzzy search, and extensible payment integration.

---

## Features

- Google OAuth authentication
- JWT access and refresh tokens
- Railway and station search
- Elasticsearch fuzzy search
- Redis caching
- Train availability checking
- Concurrency-safe seat booking
- Partial passenger seat allocation
- PostgreSQL transactions
- Redis distributed locking
- Multiple payment gateway support
- Adapter design pattern for payments
- BullMQ-based asynchronous jobs
- Booking confirmation notifications
- Payment event processing
- Booking cancellation and refunds
- Modular microservice architecture
- Docker-based local development

---

# Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| TypeScript | Type-safe application development |
| Express.js | REST API framework |
| PostgreSQL | Primary relational database |
| Prisma | ORM and database access |
| Redis | Caching, distributed locks and queues |
| BullMQ | Background job processing |
| Elasticsearch | Fuzzy railway and station search |
| Google OAuth | User authentication |
| JWT | Access and refresh token authentication |
| Docker | Local infrastructure and deployment |

---

# Architecture

```text
                         Client
                            │
                            ▼
                     API Gateway
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
    Auth Service      Search Service    Booking Service
          │                 │                 │
          ▼                 ▼                 ▼
     PostgreSQL       Elasticsearch       PostgreSQL
                            │                 │
                          Redis         Redis / Redlock
                                              │
                                              ▼
                                       Payment Service
                                              │
                                              ▼
                                           BullMQ
                                              │
                                              ▼
                                    Notification Worker
```

---

# Microservices

## Auth Service

Responsible for:

- Google OAuth
- User authentication
- Access token generation
- Refresh token generation
- Token validation
- Logout

Example endpoints:

```http
GET  /auth/google
GET  /auth/google/callback
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

---

## Search Service

Responsible for:

- Train search
- Station search
- Route search
- Elasticsearch fuzzy search
- Redis caching

Example:

```http
GET /trains/search?source=Delhi&destination=Mumbai&date=2026-10-20
```

Elasticsearch allows users to search even with partially incorrect spellings.

Example:

```text
Delih
```

can still match:

```text
Delhi
```

---

## Booking Service

Responsible for:

- Checking seat availability
- Creating bookings
- Allocating seats
- Handling multiple passengers
- Preventing double booking
- Managing booking states
- Cancelling reservations

Example request:

```json
{
  "journeyId": "journey_123",
  "passengers": [
    {
      "name": "Rahul",
      "age": 22
    },
    {
      "name": "Aman",
      "age": 24
    }
  ]
}
```

---

# Concurrency-Safe Booking

RailFlow prevents multiple users from booking the same seat simultaneously.

Example:

```text
Available seat: S10

User A ──┐
         ├── attempts booking S10
User B ──┘
```

Without concurrency protection, both requests could attempt to reserve the same seat.

RailFlow uses Redis-based distributed locking.

```text
User A
   │
   ▼
Acquire journey lock
   │
   ▼
Check availability
   │
   ▼
Reserve seat
   │
   ▼
Database transaction
   │
   ▼
Release lock
```

User B must wait until User A releases the lock.

PostgreSQL unique constraints provide an additional consistency safeguard.

---

# Partial Passenger Allocation

RailFlow supports partial seat allocation when the number of requested seats exceeds availability.

Example:

```text
Passengers requested: 3

Available seats: 2
```

Result:

```text
Passenger 1 → CONFIRMED

Passenger 2 → CONFIRMED

Passenger 3 → WAITLISTED
```

This allows the booking engine to allocate available seats while separately tracking passengers who could not immediately receive a seat.

---

# Booking Workflow

```text
User requests booking

        │
        ▼

Validate user

        │
        ▼

Validate journey

        │
        ▼

Acquire distributed lock

        │
        ▼

Check seat availability

        │
        ▼

Allocate seats

        │
        ▼

Create PENDING booking

        │
        ▼

Release lock

        │
        ▼

Process payment

        │
        ├──── Payment failed
        │          │
        │          ▼
        │   PAYMENT_FAILED
        │
        ▼

Payment successful

        │
        ▼

CONFIRMED

        │
        ▼

BullMQ event

        │
        ▼

Email / Notification
```

---

# Booking States

```text
PENDING

   │
   ├── Payment success
   │
   ▼

CONFIRMED

   │
   ├── User cancellation
   │
   ▼

CANCELLED

   │
   ├── Refund processed
   │
   ▼

REFUNDED
```

Payment failures move the booking into:

```text
PAYMENT_FAILED
```

---

# Payment Architecture

RailFlow uses the Adapter design pattern so the booking service does not depend directly on a specific payment provider.

```text
                   PaymentProvider
                         │
               ┌─────────┴─────────┐
               │                   │
               ▼                   ▼
        StripeAdapter       RazorpayAdapter
```

Interface:

```ts
interface PaymentProvider {
    createPayment(): Promise<PaymentResult>;
    verifyPayment(): Promise<boolean>;
    refundPayment(): Promise<void>;
}
```

This makes it easy to add additional payment providers without modifying the booking workflow.

---

# Background Processing

RailFlow uses BullMQ for asynchronous tasks.

Examples:

```text
Booking confirmation

Payment events

Notifications

Refund processing

Background cleanup

Analytics events
```

Example:

```text
Booking Service
      │
      ▼
    BullMQ
      │
      ▼
 Redis Queue
      │
      ▼
Background Worker
      │
      ▼
Send notification
```

This prevents slow external operations from increasing API response latency.

---

# Redis

Redis is used for several purposes.

### Caching

Frequently requested train routes and availability results can be cached.

```text
Request

   │
   ▼

Redis

   │
   ├── HIT ──────► Return response
   │
   └── MISS
         │
         ▼

     Database

         │
         ▼

     Cache result
```

### Distributed locking

Redis locks ensure multiple booking service instances cannot allocate the same seat simultaneously.

### Queues

BullMQ uses Redis to store and coordinate background jobs.

---

# Elasticsearch

Elasticsearch provides flexible train and station search.

Searchable fields include:

```text
Train name
Train number
Station name
Station code
City
```

It supports fuzzy matching so small spelling mistakes still return useful results.

---

# Database Entities

Core entities include:

```text
User

Train

Station

Route

TrainStop

Journey

Coach

Seat

Booking

Passenger

Payment
```

Basic relationship:

```text
Train
 │
 ├── Coach
 │      │
 │      └── Seat
 │
 └── Route
        │
        └── TrainStop
               │
               └── Station
```

Booking relationship:

```text
User
 │
 └── Booking
        │
        ├── Passenger
        │      │
        │      └── Seat
        │
        └── Payment
```

---

# API Overview

## Authentication

```http
GET  /auth/google

GET  /auth/google/callback

POST /auth/refresh

POST /auth/logout

GET  /auth/me
```

## Train Search

```http
GET /trains/search

GET /trains/:trainId

GET /trains/:trainId/availability
```

## Booking

```http
POST /bookings

GET /bookings/:bookingId

GET /users/me/bookings

POST /bookings/:bookingId/cancel
```

## Payments

```http
POST /payments/create

POST /payments/verify

POST /payments/webhook
```

---

# Project Structure

```text
railflow/
│
├── services/
│   │
│   ├── auth-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   └── index.ts
│   │   │
│   │   └── package.json
│   │
│   ├── search-service/
│   │
│   ├── booking-service/
│   │
│   ├── payment-service/
│   │
│   └── notification-service/
│
├── shared/
│   ├── types/
│   ├── utils/
│   ├── constants/
│   └── middleware/
│
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

---

# Local Development

Clone the repository:

```bash
git clone https://github.com/<username>/railflow.git

cd railflow
```

Install dependencies:

```bash
npm install
```

Create environment variables:

```bash
cp .env.example .env
```

Start infrastructure:

```bash
docker compose up -d
```

Run database migrations:

```bash
npx prisma migrate dev
```

Start development server:

```bash
npm run dev
```

---

# Environment Variables

Example:

```env
DATABASE_URL=

REDIS_URL=

JWT_ACCESS_SECRET=

JWT_REFRESH_SECRET=

GOOGLE_CLIENT_ID=

GOOGLE_CLIENT_SECRET=

ELASTICSEARCH_URL=

PAYMENT_PROVIDER_KEY=
```

Never commit real secrets to source control.

---

# Engineering Concepts Demonstrated

RailFlow demonstrates:

- REST API design
- Microservices
- Authentication and authorization
- OAuth 2.0
- JWT
- PostgreSQL transactions
- Database constraints
- Race condition handling
- Distributed locking
- Caching
- Distributed queues
- Event-driven processing
- Elasticsearch
- Fuzzy search
- Adapter design pattern
- Background workers
- Idempotency
- Fault tolerance

---

# Future Improvements

Possible future additions:

- Waiting-list promotion
- RAC-style reservation
- WebSocket booking updates
- Rate limiting
- API Gateway
- Service discovery
- Kafka-based event streaming
- Observability with Prometheus and Grafana
- Distributed tracing
- Circuit breakers
- Kubernetes deployment
- Train scheduling engine
- Dynamic pricing
- Seat preference matching

---

# Purpose

RailFlow was developed as a backend and system-design project to explore how high-concurrency reservation systems handle authentication, search, distributed state, seat allocation, payments, asynchronous processing, and consistency across multiple services.
