<p align="center">
  <img src="https://img.shields.io/badge/NutriTiffin-Backend-1a1a2e?style=for-the-badge&labelColor=E0234E&color=1a1a2e" alt="NutriTiffin Backend" />
</p>

<h1 align="center">NutriTiffin — Backend API</h1>

<p align="center">
  <strong>Production-style REST API for a home-kitchen meal marketplace: subscriptions, credits, deliveries, and payments.</strong>
</p>

<p align="center">
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker" /></a>
</p>

<p align="center">
  <a href="#for-recruiters--interviewers"><b>Recruiter summary</b></a> ·
  <a href="#ecosystem--mobile-apps"><b>Mobile apps</b></a> ·
  <a href="#platform-features-this-backend-powers"><b>Features</b></a> ·
  <a href="#what-this-project-is"><b>Overview</b></a> ·
  <a href="#technical-highlights"><b>Highlights</b></a> ·
  <a href="#architecture"><b>Architecture</b></a> ·
  <a href="#getting-started"><b>Quick start</b></a> ·
  <a href="#api-overview"><b>API</b></a> ·
  <a href="#documentation"><b>Docs</b></a>
</p>

---

## For recruiters & interviewers

| | |
| :--- | :--- |
| **Domain** | B2C marketplace connecting **home kitchens** with customers who want **scheduled, home-cooked meals**—menus, caps, fees, and delivery—not a thin CRUD demo. |
| **What this repository is** | The **backend only**: a **NestJS** modular monolith exposing **REST JSON APIs** consumed by **three separate mobile applications** (see below). |
| **Client surface** | **Three mobile apps**—**Customer**, **Kitchen owner**, and **Delivery driver**—each shipped as its **own iOS and Android** build (native stacks per platform, not one generic web shell). |
| **What it demonstrates** | **RBAC** with JWT, **PostgreSQL + TypeORM** (transactions, pessimistic locking where money moves), **Razorpay** (initiate → verify signature → persist; refunds on rejection), **AWS S3** media, **Redis + BullMQ** jobs, **live GPS + Google Routes** for tracking, **FCM** push, **throttling**, and **role / API docs** under `docs/`. |
| **Who uses the API** | Four roles: `CLIENT`, `KITCHEN_OWNER`, `DELIVERY_DRIVER`, `ADMIN`—each with distinct controllers, DTOs, and guards. |

**Elevator pitch:** *NutriTiffin is a full operational stack for a meal marketplace: three native mobile clients talk to one hardened API that handles auth, menus, constrained ordering, payments, delivery state, optional live maps, in-app credits, and admin tooling—with integrity and abuse resistance baked in.*

---

## Ecosystem — mobile apps

This API is the single backend for **three dedicated mobile products** (each with **separate iOS and Android** apps):

| App | Audience | Typical responsibilities |
| :--- | :--- | :--- |
| **Customer** | End users | Discover kitchens, browse menus, place orders, pay (Razorpay), track delivery, reviews, profile & wallet. |
| **Kitchen** | Home-kitchen operators | Menu & availability, order inbox (accept / reject / ready), earnings context, veg tagging, customer prep **notes**. |
| **Driver** | Delivery partners | Job board, accept route, pickup → out for delivery → delivered, GPS pings, handoff verification. |

Together, they show **end-to-end product thinking**: one domain model, multiple personas, shared infrastructure (auth, media, notifications, ledger).

---

## Platform features (this backend powers)

High-level **capabilities** recruiters can map to “real product” scope:

- **Identity & trust** — Registration, JWT sessions, email verification (Brevo), SMS/OTP-oriented flows, password reset, username availability with **suggested alternatives**, role-specific onboarding.
- **Kitchens & discovery** — Kitchen CRUD, imagery, **service-area / pincode** style gating where implemented, **veg / non-veg** kitchen tagging for diet-aware UX.
- **Menus & capacity** — Food items with **per-day availability**, **daily order limits**, inactive items; order-time validation and sold-out logic.
- **Orders** — **1–3 days ahead** scheduling, fee breakdown (platform, kitchen, delivery, tax), status lifecycle (pending → accepted/rejected → ready → pickup → out for delivery → delivered), **optional client notes** for kitchen customization, **auto-reject timeout** (queued) when kitchens do not respond.
- **Payments** — **Razorpay**: server-side quote validation, **HMAC signature check**, persist only after verified capture; **refund path** when orders are rejected after payment.
- **Deliveries** — Driver assignment, state transitions, **OTP-style handoff** between driver and customer for completion.
- **Live tracking** — Driver location in **Redis**, **Google Routes** for ETA / polyline; throttled **map snapshot** endpoints for clients and drivers.
- **Money in-app** — **Credit wallet** with **transactional ledger**, pessimistic locking on balance changes, admin credit/debit, readable transaction references.
- **Social proof** — **1–5 star** ratings per **order line**; public **`GET /restaurants/:id/stats`** for kitchen-level aggregates (no stored average on the kitchen row); scoped review listing APIs.
- **Media** — Image uploads to **AWS S3** (avatars, food photos).
- **Engagement** — **Firebase Cloud Messaging** for push when configured (e.g. new order, status changes).
- **Operations** — Admin user/credit/maintenance controls, **public stats** with strict rate limits, health/uptime endpoints.

### Talking points for technical interviews

- **Financial and inventory integrity** — Ledger updates and payment capture go through **transactions** and, where needed, **pessimistic locking**; order creation respects **per-item daily caps** with concurrency-aware querying.
- **Verify-then-persist payments** — Razorpay **signature verification** and amount reconciliation against a server-computed quote before an order row is written; **refund orchestration** when kitchens reject paid orders.
- **Real-world async** — **BullMQ** for time-based policies (e.g. pending-order handling) and **Redis** for queues, caching-style tracking keys, and live driver coordinates.
- **Security posture** — JWT + **RBAC**, global **DTO validation**, **throttling** (including stricter buckets for sensitive routes), environment-driven production strictness.
- **Third-party surface area** — **AWS S3**, **Firebase Admin (FCM)**, **Brevo**, **Google Routes/Geocoding**—integrations typical of shipping backends, not tutorial scope.
- **Contract clarity** — **`docs/`** includes API reference and **per-role** flow documents so reviewers can validate design without spelunking every controller.

---

## What this project is

**NutriTiffin** is a food-platform backend aimed at **scheduled meals**, **diet-aware offerings**, and **small kitchen operators** who need tooling comparable to larger delivery apps—menus, caps on daily orders, earnings, and driver handoff. The **three mobile apps** (customer, kitchen, driver) on **iOS and Android** are the primary consumers of this API.

**Stakeholders and value**

| Stakeholder | Value |
| :--- | :--- |
| **Clients** | Browse kitchens and menus, place orders, pay via Razorpay, track delivery, review items/kitchens. |
| **Kitchen owners** | Manage profile, menu, availability, accept/reject orders, see earnings (fees split across platform, kitchen, delivery). |
| **Delivery drivers** | Accept jobs, move orders through pickup → out for delivery → delivered; credit-based payout flows tie into the ledger. |
| **Admins** | User oversight, credit add/deduct, transaction visibility, maintenance toggles. |

---

## Technical highlights

- **Credit wallet & ledger** — Integer rupee balances with **TypeORM transactions** and **pessimistic row-level locking** to avoid race conditions on concurrent debits/credits. Movements are recorded with readable references (e.g. `TXN-…`) for support and audit.
- **Role-based access** — `JwtAuthGuard`, `RolesGuard`, and `@Roles()` enforce separation across the API surface.
- **Order lifecycle** — Explicit states (e.g. pending → accepted/rejected → picked up → out for delivery → delivered) keep kitchen and driver workflows consistent.
- **Fees** — Configurable **platform**, **kitchen**, and **delivery** fee components per order (environment-driven defaults).
- **Menus** — Items support **per-day availability** and **daily order limits** so kitchens do not oversell.
- **Auth & trust** — Email verification (e.g. **Brevo**), SMS OTP path for production-style verification, password reset flows, and **throttling** on sensitive auth routes.
- **Payments** — **Razorpay**: initiate from cart validation, confirm with signature verification before persisting paid orders.
- **Media** — **AWS S3** for uploads (e.g. avatars, food images) with validation and presigned-style patterns as implemented in services.
- **Async work** — **Redis** + **BullMQ** (e.g. order-related jobs via `JobsModule`).
- **Push (optional)** — **Firebase Admin** in `NotificationsModule` for FCM when a service account key is present.
- **Live delivery tracking** — Driver GPS in **Redis**, **Google Routes** for ETA/polyline (`GOOGLE_MAPS_API_KEY`); see [`docs/Maps.md`](docs/Maps.md).

---

## Security practices (summary)

1. **Authentication & authorization** — JWT sessions; RBAC; admin registration gated by `ADMIN_ACCESS_PASS`.
2. **Verification** — Email verification; SMS OTP for stricter production paths (see `docs/guide-otp-implementation.md`).
3. **Data integrity** — DB transactions and pessimistic locks where balances or multi-table updates occur.
4. **API hardening** — Global validation pipes (`class-validator` / `class-transformer`); NestJS throttler with environment-aware limits.
5. **Secrets & environments** — Configuration via env vars; `PRODUCTION` flag controls stricter vs. developer-friendly behavior (e.g. OTP bypass locally when disabled).
6. **Object storage** — User media in S3 with IAM-scoped credentials rather than local disk in production setups.

---

## Architecture

Modular **NestJS 11** monolith on **Node.js 20+**, **TypeScript**, **PostgreSQL** via **TypeORM**, **Redis** for BullMQ and caching-style use, and **AWS S3** for files.

### Request path (high level)

```
┌─────────────────────────┐
│  Web / mobile clients   │
└───────────┬─────────────┘
            │  HTTPS / JSON
            ▼
┌─────────────────────────────────────────┐
│  NestJS API                             │
│  JWT · Throttler · RBAC · DTO validation │
└───────────┬─────────────────────────────┘
            │
     ┌──────┴──────┬──────────────┐
     ▼             ▼              ▼
 PostgreSQL     Redis         AWS S3
 (TypeORM)    (BullMQ etc.)   (media)
```

### Module map (conceptual)

```
AppModule
├── AuthModule           JWT, registration, verification, password flows
├── UsersModule          Profiles, credits, admin user/credit actions
├── KitchensModule       Kitchen CRUD, operating context
├── FoodItemsModule      Menu, availability, daily limits
├── OrdersModule         Orders, state transitions, Razorpay payments
├── DeliveriesModule     Driver workflow
├── DeliveryTrackingModule  Live GPS + Google Routes (Redis, tracking DTOs)
├── TransactionsModule   Credit ledger, listings
├── UploadModule         S3 uploads
├── JobsModule           BullMQ-backed background processing
├── ReviewsModule        Client reviews for items/kitchens
├── NotificationsModule  FCM (Firebase Admin) when configured
├── RedisModule          Redis connectivity
└── CommonModule         Shared filters, DTOs, utilities, S3 helpers
```

---

## Tech stack

| Layer | Technology |
| :--- | :--- |
| Runtime | Node.js 20+ |
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| Database | PostgreSQL |
| ORM | TypeORM |
| Cache / queues | Redis, BullMQ |
| Auth | Passport, JWT |
| Payments | Razorpay |
| Email | Brevo (Sendinblue) |
| Storage | AWS S3 (`@aws-sdk/client-s3`) |
| Push | Firebase Admin (optional) |
| Validation | class-validator, class-transformer |
| Containers | Docker, Docker Compose |

---

## Getting started

### Prerequisites

| Tool | Notes |
| :--- | :--- |
| Node.js | 20+ |
| npm | 9+ |
| Docker & Docker Compose | Recommended for Redis + consistent setup |
| PostgreSQL / Redis | Required if not using Compose for those services |

### Option A — Docker (recommended)

```bash
git clone https://github.com/Ur-Code-Buddy/nutribackend.git
cd nutribackend
cp .env.example .env
# Edit .env: database, JWT, AWS, Brevo, Razorpay, etc.

docker-compose up --build
```

API base URL: **`http://localhost:3000`** (adjust if mapped differently).

### Option B — Local

```bash
git clone https://github.com/Ur-Code-Buddy/nutribackend.git
cd nutribackend
npm install
cp .env.example .env
npm run start:dev
```

### Environment variables

Copy `.env.example` and fill in values. Common groups:

- **Database** — `DB_*` or a single `DATABASE_URL` (supported in `AppModule` TypeORM config).
- **Auth** — `JWT_SECRET`, `JWT_EXPIRATION`, `ADMIN_ACCESS_PASS` (admin signup).
- **AWS S3** — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME`.
- **Redis** — `REDIS_HOST`, `REDIS_PORT`, optional `REDIS_TLS`, `REDIS_PASSWORD`.
- **Fees** — `PLATFORM_FEES`, `KITCHEN_FEES`, `DELIVERY_FEES` (rupee amounts).
- **Email / URLs** — `BREVO_API_KEY`, `BASE_URL`, `FRONTEND_URL`.
- **Behavior** — `PRODUCTION` (`true`/`false`) affects throttling and verification strictness.

<details>
<summary><strong>Expanded variable list</strong></summary>

| Variable | Description |
| :--- | :--- |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL connection |
| `DB_SSL` | SSL for DB |
| `DATABASE_URL` | Alternative single URL for Postgres |
| `JWT_SECRET`, `JWT_EXPIRATION` | JWT signing |
| `AWS_*` | S3 credentials and bucket |
| `REDIS_*` | Redis connection |
| `CURRENT_VERSION` | API version string |
| `PLATFORM_FEES`, `KITCHEN_FEES`, `DELIVERY_FEES` | Per-order fee defaults |
| `ADMIN_ACCESS_PASS` | Admin registration secret |
| `BREVO_API_KEY` | Transactional email |
| `BASE_URL`, `FRONTEND_URL` | App URLs for links and CORS-related config |

</details>

---

## API overview

Authoritative request/response detail lives in **[`docs/api-reference.md`](docs/api-reference.md)**.

**Surface area (summary)**

| Area | Examples |
| :--- | :--- |
| **Auth** | Register, login, email verify, OTP/resend, forgot/reset password |
| **Users** | Profile, admin user list, credit add/deduct, enable/disable account |
| **Kitchens** | CRUD, public listing, owner credit view |
| **Menu** | Owner CRUD, public menu by kitchen, availability |
| **Orders** | Create/list, accept/reject, role-scoped reads |
| **Payments** | `POST /payments/initiate`, `POST /payments/confirm` (Razorpay) |
| **Deliveries** | Available jobs, accept, pickup, out for delivery, finish, **GPS pings** (`PATCH /deliveries/:id/location`) |
| **Live tracking** | Customer/driver **map snapshot** (`GET /orders/:id/tracking`) — see [`docs/Maps.md`](docs/Maps.md) |
| **Transactions** | Paginated history (user/admin) |
| **Reviews / ratings** | `POST /orders/:orderId/items/:itemId/rating` (client upsert), list by item/kitchen, “my reviews”; **`GET /restaurants/:id/stats`** (public aggregates) |
| **Upload** | Image upload to S3 |
| **Ops** | `GET /health`, `GET /uptime`, maintenance flag endpoints |

---

## Documentation

| Document | Purpose |
| :--- | :--- |
| [`docs/api-reference.md`](docs/api-reference.md) | Endpoint reference and auth pipeline |
| [`docs/Maps.md`](docs/Maps.md) | Live delivery tracking: client/driver implementation, endpoints, Google keys |
| [`docs/api.md`](docs/api.md) | Additional API notes (if present) |
| [`docs/role-client.md`](docs/role-client.md) | Client journeys |
| [`docs/role-kitchen-owner.md`](docs/role-kitchen-owner.md) | Kitchen owner flows |
| [`docs/role-delivery-driver.md`](docs/role-delivery-driver.md) | Driver flows |
| [`docs/frontend-guidelines.md`](docs/frontend-guidelines.md) | Frontend integration |
| [`docs/setup-bullmq-docker.md`](docs/setup-bullmq-docker.md) | Redis / BullMQ with Docker |
| [`docs/setup-project-docker.md`](docs/setup-project-docker.md) | Container setup |
| [`docs/guide-otp-implementation.md`](docs/guide-otp-implementation.md) | OTP behavior and implementation notes |
| [`docs/legal.md`](docs/legal.md) | Legal / compliance notes |

---

## Testing

```bash
npm run test          # unit
npm run test:watch
npm run test:e2e      # E2E
npm run test:cov      # coverage
```

---

## Database (entity relationships — simplified)

```
Users ─────┬───── Kitchens ───── Food items
           │
           ├──── Orders ───── Order items
           │       (fees: platform / kitchen / delivery)
           │
           └──── Transactions (ledger, short ids, types)
```

Full column-level detail is in TypeORM entities under `src/**/entities/`.

---

## Scripts

| Script | Command |
| :--- | :--- |
| Dev (watch) | `npm run start:dev` |
| Debug | `npm run start:debug` |
| Production | `npm run start:prod` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Format | `npm run format` |

---

## Project structure

```
backend/
├── src/
│   ├── auth/            JWT, guards, roles, DTOs
│   ├── users/           Users, admin controller, credits
│   ├── kitchens/
│   ├── food-items/
│   ├── orders/          Orders, payments (Razorpay)
│   ├── deliveries/
│   ├── delivery-tracking/  Live GPS, Google Routes/Geocoding, Redis tracking keys
│   ├── transactions/
│   ├── reviews/
│   ├── notifications/   Firebase push (when configured)
│   ├── upload/          S3 uploads
│   ├── jobs/            BullMQ workers / queue registration
│   ├── queue/           Email queue processor module (code)
│   ├── redis/
│   ├── common/          Filters, shared DTOs, S3, utils
│   ├── app.module.ts
│   └── main.ts
├── docs/
├── scripts/
├── test/
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## Maintainer

Developed by **[Ur-Code-Buddy](https://github.com/Ur-Code-Buddy)**.

For deep dives, start with [`docs/api-reference.md`](docs/api-reference.md) and the module map above. For map/tracking integration, see [`docs/Maps.md`](docs/Maps.md).
