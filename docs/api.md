# API Endpoints

Concise reference for **Razorpay advance payment** order placement. For the full API surface, see [`api-reference.md`](./api-reference.md).

**Base URL (local):** `http://localhost:3000`

**Server env (never expose to clients):** `RAZORPAY_KEY_SECRET` — used only for HMAC verification on `POST /payments/confirm`.

**Client env:** `RAZORPAY_API_KEY` is returned as `publicKey` from `POST /payments/initiate` for Razorpay Checkout / Standard integration.

---

## Authentication

All endpoints in this file require `Authorization: Bearer <JWT>`.

| Endpoint | Role |
| :--- | :--- |
| `POST /payments/initiate` | `CLIENT` |
| `POST /payments/confirm` | `CLIENT` |

**Legacy (unchanged):** `POST /orders` also requires `CLIENT` and creates an order immediately without Razorpay; see [`api-reference.md`](./api-reference.md) § Orders.

---

## 1. Initiate Payment

### `POST /payments/initiate`

Creates a Razorpay order after running the same backend validations used for order creation (date window, item availability, sold-out checks, fee calculation).

It does NOT save an `Order` in the database.

**Request Body** (same as `CreateOrderDto`):

```json
{
  "kitchen_id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
  "scheduled_for": "2026-02-16",
  "items": [
    { "food_item_id": "aebf865c-ab8e-405b-9e5b-ab4fce869084", "quantity": 2 }
  ]
}
```

**Success Response**:

```json
{
  "razorpayOrderId": "order_....",
  "publicKey": "rzp_test_...."
}
```

---

## 2. Confirm Payment

### `POST /payments/confirm`

Verifies the Razorpay payment signature (HMAC SHA256) and confirms the payment is `captured` and matches the backend-computed amount.

Only after verification does the backend create and save the `Order` (and marks `paymentStatus = PAID`).

**Request Body**:

```json
{
  "razorpayOrderId": "order_....",
  "razorpayPaymentId": "pay_....",
  "razorpaySignature": "....",
  "originalDto": {
    "kitchen_id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
    "scheduled_for": "2026-02-16",
    "items": [
      { "food_item_id": "aebf865c-ab8e-405b-9e5b-ab4fce869084", "quantity": 2 }
    ]
  }
}
```

**Success Response:** Same shape as **`POST /orders`** after a successful create (saved `Order` entity), including:

- `paymentStatus`: `"PAID"`
- `razorpayOrderId`, `razorpayPaymentId`: Razorpay identifiers
- `status`: `"PENDING"` (kitchen has not accepted yet)

**Errors:**
- `400 Bad Request` for invalid signature, payment not captured, order/amount mismatch, or order validation failures.

---

## Recommended client flow

1. `POST /payments/initiate` with the same body you would send to `POST /orders` → receive `razorpayOrderId` + `publicKey`.
2. Complete payment in the Razorpay UI (amount must match the backend-computed total for that cart).
3. `POST /payments/confirm` with Razorpay's `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, and the **same** `originalDto` as step 1.
4. Use `GET /orders` / `GET /orders/:id` as before to track status.

