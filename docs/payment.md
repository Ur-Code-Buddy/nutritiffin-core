# Payments (Razorpay)

This document describes **payment-related HTTP endpoints** and how **paid orders**, **refunds**, and **order API responses** fit together. For the full API surface, see [`api-reference.md`](./api-reference.md).

**Base URL (local):** `http://localhost:3000`

---

## Environment (server)

| Variable              | Notes                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `RAZORPAY_API_KEY`    | Key id (safe to expose to clients as `publicKey` from initiate).      |
| `RAZORPAY_KEY_SECRET` | Server-only. Used for HMAC verification on `POST /payments/confirm`. |

Never ship `RAZORPAY_KEY_SECRET` to mobile or web clients.

---

## Authentication

All routes under `/payments` require:

`Authorization: Bearer <JWT>`

| Endpoint                 | Role     |
| ------------------------ | -------- |
| `POST /payments/initiate` | `CLIENT` |
| `POST /payments/confirm`  | `CLIENT` |

---

## `POST /payments/initiate`

Creates a **Razorpay Order** after running the same validations as order creation (schedule window, item availability, sold-out checks, fees). **No `Order` row is saved** until confirm succeeds.

**Request body:** Same as **Create Order** — `kitchen_id`, `scheduled_for` (`YYYY-MM-DD` date string), `items[]` with `food_item_id` and `quantity`.

**Success response:**

| Field             | Type   | Description                                                |
| ----------------- | ------ | ---------------------------------------------------------- |
| `razorpayOrderId` | string | Razorpay order id (`order_...`) for Checkout / Standard.   |
| `publicKey`       | string | Razorpay key id (`RAZORPAY_API_KEY`) for the client SDK.   |

**Typical errors:** `400 Bad Request` when validation fails (date window, sold out, inactive items, etc.).

---

## `POST /payments/confirm`

Verifies the payment using:

1. **HMAC SHA256** signature: `HMAC-SHA256(razorpayOrderId + "|" + razorpayPaymentId, RAZORPAY_KEY_SECRET)` must equal `razorpaySignature`.
2. **Razorpay API:** `payments.fetch(razorpayPaymentId)` — payment must belong to `razorpayOrderId`, status must be **`captured`**, and **amount in paise** must match the server’s quote for `originalDto`.

Only after these checks does the backend **create and persist** the `Order` with `paymentStatus: PAID` and Razorpay ids set.

**Request body:**

| Field               | Type   | Required | Description                                                                 |
| ------------------- | ------ | -------- | --------------------------------------------------------------------------- |
| `razorpayOrderId`   | string | Yes      | From initiate / Checkout (`order_...`).                                     |
| `razorpayPaymentId` | string | Yes      | From successful payment (`pay_...`).                                        |
| `razorpaySignature` | string | Yes      | From Checkout / client SDK.                                                 |
| `originalDto`       | object | Yes      | **Same** body as used for `POST /payments/initiate` (kitchen, date, items). |

**Success response:** The saved **Order** entity (same general shape as `POST /orders`), including:

- `paymentStatus`: `"PAID"`
- `razorpayOrderId`, `razorpayPaymentId`
- `status`: `"PENDING"` until the kitchen accepts or rejects
- Refund fields (see below), initially `refund_status: "NOT_APPLICABLE"` and null refund metadata

**Idempotency:** Repeating confirm with the same `razorpayPaymentId` returns the **existing** order instead of creating a duplicate.

**Typical errors:** `400 Bad Request` for invalid signature, payment not captured, order/payment mismatch, amount mismatch vs server quote, or order validation failure.

---

## Order APIs and payment state

Payment state and refunds are exposed on **order** responses (e.g. `GET /orders`, `GET /orders/:id`), not on separate payment URLs after confirm.

### Payment and refund fields (on `Order`)

| Field                 | Type           | Description |
| --------------------- | -------------- | ----------- |
| `paymentStatus`       | enum           | `PENDING` (e.g. legacy `POST /orders` without Razorpay) or `PAID` (confirm path). |
| `razorpayOrderId`     | string \| null | Set when paid via Razorpay. |
| `razorpayPaymentId`   | string \| null | Set when paid via Razorpay. |
| `refund_status`       | enum           | `NOT_APPLICABLE`, `PENDING`, `COMPLETED`, `FAILED`. |
| `razorpay_refund_id`  | string \| null | Razorpay refund id when a refund was created. |
| `refund_initiated_at` | string \| null | ISO timestamp when refund was requested. |
| `refund_expected_by`  | string \| null | `YYYY-MM-DD` (UTC calendar); use for “expect by” UX (policy: typically 5–7 business days; server sets from **7 business days** after initiation). |

### Rejection and automatic refund

When a **paid** order becomes **`REJECTED`** (kitchen **`PATCH /orders/:id/reject`** or **auto-reject after order timeout**), the server:

- Initiates a **full refund** in Razorpay for the captured payment (amount aligned with `total_price`).
- Updates `refund_status` (e.g. `PENDING` on success, `FAILED` if the refund API fails), `razorpay_refund_id`, `refund_initiated_at`, and `refund_expected_by`.
- Sends a **push notification** to the customer (including refund messaging when applicable).

**Unpaid** (legacy) orders: no Razorpay refund; `refund_status` stays **`NOT_APPLICABLE`**.

Details and roles: [`api-reference.md`](./api-reference.md) (Orders — Get Order, Reject Order).

---

## Legacy: `POST /orders` (no Razorpay)

`POST /orders` still creates an order **immediately** without going through `/payments/*`. Those orders use `paymentStatus: PENDING` and null Razorpay fields unless you migrate flows. Prefer **`/payments/initiate` + `/payments/confirm`** for production checkout.

---

## Recommended client checkout flow

1. **`POST /payments/initiate`** with the cart → `razorpayOrderId` + `publicKey`.
2. Open Razorpay Checkout (or Standard) with that order id and key; user pays.
3. **`POST /payments/confirm`** with Razorpay’s `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, and the **same** `originalDto` as step 1.
4. Poll or subscribe to **`GET /orders`** / **`GET /orders/:id`** for `status` and kitchen updates.
5. If `status === "REJECTED"` and `paymentStatus === "PAID"`, show refund copy using **`refund_status`** and **`refund_expected_by`** (e.g. refund initiated, 5–7 business days).

---

## Related documentation

- Full endpoint reference: [`api-reference.md`](./api-reference.md)
- Shorter payment cheat sheet: [`api.md`](./api.md)
- Refund policy wording (legal): [`legal.md`](./legal.md)
