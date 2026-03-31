# NutriTiffin Client API Documentation

**Production Base URL:** `https://backend.v1.nutritiffin.com`

- All IDs are UUID strings.
- All prices are stored as decimal in database and returned as string.
- All protected endpoints require header: `Authorization: Bearer <JWT>`
- Role required for order endpoints: `CLIENT`

---

## 0. PRE-CHECK

### 0.1 Check District Availability

**`GET /is-my-district-available?pincode=...`**

Public endpoint to check if delivery is available for a specific pincode.

**Query Parameters:**
- `pincode` (string, required): The 6-digit pincode to check.

**Example Response:**
`true`

### 0.2 Get Platform Charges

**`GET /charges`**

Retrieves the fixed platform fees, kitchen percentage fees, and delivery fees.

**Success Response:**
```json
{
  "platform_fees": 10,
  "kitchen_fees": 15,
  "delivery_fees": 20
}
```

---

## 1. AUTHENTICATION

### 1.1 Register Client

**`POST /auth/register`**

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "username": "client_user01",
  "name": "Rahul Sharma",
  "email": "rahul.sharma01@example.com",
  "phone_number": "+919876543210",
  "address": "123 MG Road, Pondicherry, Puducherry, India",
  "pincode": "605001",
  "password": "client123",
  "role": "CLIENT"
}
```

**Success Response (201):**
```json
{
  "id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
  "username": "client_user01",
  "name": "Rahul Sharma",
  "phone_number": "+919876543210",
  "address": "123 MG Road, Pondicherry, Puducherry, India",
  "pincode": "605001",
  "role": "CLIENT",
  "created_at": "2026-02-15T06:10:16.854Z",
  "updated_at": "2026-02-15T06:10:16.854Z"
}
```

**Validation Rules:**
- `username` required, unique
- `email` required, valid format, unique (but not returned in response)
- `phone_number` required, unique
- `password` minimum 6 characters
- `role` must be `CLIENT`

---

### 1.2 Login

**`POST /auth/login`**

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "username": "client_user01",
  "password": "client123"
}
```

**Success Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
    "username": "client_user01",
    "role": "CLIENT"
  }
}
```

---

### 1.3 Verify Email

**`GET /auth/verify-email?token=...`**

Redirects the user to the frontend application:
- On success: Redirects to `FRONTEND_URL/verification-success`.
- On error: Redirects to `FRONTEND_URL/verification-failed?reason=expired` or `?reason=invalid`.

---

### 1.4 Resend Verification

**`POST /auth/resend-verification`**

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "email": "rahul.sharma01@example.com"
}
```
Generates a new token (valid for 24 hours) and sends a new verification email.

---

### 1.5 Get My Profile

**`GET /users/me`**

Returns the authenticated user's profile and current credit balance.

**Success Response:**
```json
{
  "id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
  "username": "client_user01",
  "name": "Rahul Sharma",
  "email": "rahul.sharma01@example.com",
  "phone_number": "+919876543210",
  "address": "123 MG Road, Pondicherry, Puducherry, India",
  "pincode": "605001",
  "profile_picture_url": "https://nutri.s3.ap-south-1.amazonaws.com/uploads/photo.jpg",
  "role": "CLIENT",
  "credits": 50,
  "is_active": true,
  "created_at": "2026-02-15T06:10:16.854Z",
  "updated_at": "2026-02-15T06:10:16.854Z"
}
```

`profile_picture_url` is `null` until set via **`PATCH /users/me`** (typically after **`POST /upload-image`**).

---

### 1.6 Check Email Verified

**`POST /auth/check-email-verified`**

**Content-Type:** `application/json`

Checks whether the provided email is verified. Has a rate limit: max 1 request every 10 seconds.

**Request Body:**
```json
{
  "email": "rahul.sharma01@example.com"
}
```

**Success Response:**
```json
{
  "is_verified": true
}
```

---

### 1.7 Check Username Availability

**`GET /users/check-username/:username`**

Public endpoint (no auth required). Rate limited to **10 requests per minute** and **25 requests per hour**.

**Success Response:**
```json
{
  "exists": false
}
```

---

### 1.8 Update Profile

**`PATCH /users/me`**

Requires: `Authorization: Bearer <JWT>`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "current_password": "client123",
  "address": "456 New Street, Bangalore, Karnataka",
  "phone_number": "9998887770",
  "pincode": "560001",
  "profile_picture_url": "https://nutri.s3.ap-south-1.amazonaws.com/uploads/new-avatar.jpg"
}
```

All fields except `current_password` are optional — include only what you want to change.

To **remove** the profile picture, send `"profile_picture_url": null`.

**Business Rules:**
- `current_password` is **required** and verified before applying any changes
- If `phone_number` changes, `phone_verified` is reset to `false` and a 4-digit SMS OTP is sent automatically
- Returns `401` if password is incorrect
- Returns `409` if the new phone number is already taken
- `profile_picture_url` must be a valid **http** or **https** URL (max 2048 characters), or **`null`** to clear
- A **notification email** is sent listing the changed fields

**Success Response (with phone change):**
```json
{
  "message": "Profile updated successfully. An OTP has been sent to your new phone number for verification.",
  "phone_verification_required": true,
  "user": {
    "id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
    "username": "client_user01",
    "name": "Rahul Sharma",
    "email": "rahul.sharma01@example.com",
    "phone_number": "9998887770",
    "address": "456 New Street, Bangalore, Karnataka",
    "pincode": "560001",
    "profile_picture_url": "https://nutri.s3.ap-south-1.amazonaws.com/uploads/new-avatar.jpg",
    "role": "CLIENT",
    "credits": 50,
    "phone_verified": false,
    "is_active": true
  }
}
```

---

## 2. KITCHENS

### 2.1 Get All Active Kitchens

**`GET /kitchens`**

Returns only:
- `is_active = true`
- `is_menu_visible = true`

**Success Response:**
```json
[
  {
    "id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
    "name": "Arjuns Kitchen",
    "details": {
      "phone": "7738087085",
      "address": "123",
      "description": "Best kitchen in town"
    },
    "operating_hours": {
      "monday": { "open": "09:00", "close": "21:00" },
      "tuesday": { "open": "09:00", "close": "21:00" }
    },
    "image_url": "https://example.com/kitchen.jpg",
    "is_veg": true,
    "created_at": "2026-02-15T06:11:11.126Z",
    "updated_at": "2026-02-15T06:31:08.132Z"
  }
]
```

Each kitchen includes **`is_veg`**: **`true`** = veg tag, **`false`** = non-veg.

---

## 3. MENU ITEMS

### 3.1 Get Menu Items by Kitchen

**`GET /menu-items/kitchen/:kitchenId`**

Example:
`GET /menu-items/kitchen/c282d569-e3a9-4820-ad35-d4093a8b96d8`

**Success Response:**
```json
[
  {
    "id": "aebf865c-abf8-405b-9e5b-ab4fce869084",
    "kitchen_id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
    "name": "Pizza",
    "description": "wood fired",
    "price": "100.00",
    "image_url": "https://nutri.s3.ap-south-1.amazonaws.com/uploads/e41b0fd1.jpg",
    "max_daily_orders": 5,
    "is_available": true,
    "created_at": "2026-02-15T06:37:20.398Z",
    "updated_at": "2026-02-15T06:37:20.398Z"
  }
]
```

**Business Rules:**
- Only return items where `is_available = true`
- Kitchen must be active
- Kitchen menu must be visible

---

## 4. ORDERS

All order endpoints require: `Authorization: Bearer <CLIENT_JWT>`

### 4.0 Place order with Razorpay (advance payment)

Use this flow when the client must pay before the order is stored.

1. **`POST /payments/initiate`** — Same JSON body as create order (see § 4.1), including optional **`notes`** for the kitchen. Response: `{ "razorpayOrderId", "publicKey" }`. No `Order` row is created yet.
2. Complete payment with Razorpay (Checkout / Standard) using that order id and key.
3. **`POST /payments/confirm`** — Body:

```json
{
  "razorpayOrderId": "order_...",
  "razorpayPaymentId": "pay_...",
  "razorpaySignature": "...",
  "originalDto": { "kitchen_id": "...", "scheduled_for": "YYYY-MM-DD", "items": [ ... ], "notes": "Optional text for the kitchen" }
}
```

The `originalDto` must match the payload used in step 1 (**including `notes`**, if you sent it in step 1 — omit the key or use the same value). On success, the backend saves the order with `paymentStatus: PAID` and Razorpay ids set.

Errors return `400` for bad signature, uncaptured payment, amount mismatch, or validation failures.

### 4.1 Create Order (legacy — immediate save)

**`POST /orders`**

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "kitchen_id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
  "scheduled_for": "2026-02-16",
  "notes": "Less oil; no dairy (optional)",
  "items": [
    {
      "food_item_id": "aebf865c-abf8-405b-9e5b-ab4fce869084",
      "quantity": 2
    },
    {
      "food_item_id": "e9663f29-718b-44d9-a8e9-eecf9dc6f68e",
      "quantity": 1
    }
  ]
}
```

Omit **`notes`** or leave it empty if the customer has no special instructions. Max length **2000** characters; the server trims whitespace.

**Business Rules:**
- `scheduled_for` must be **1–3 days in advance** (date-only `YYYY-MM-DD`)
- `items` array cannot be empty
- `quantity` minimum 1
- all items must belong to same kitchen
- backend calculates `snapshot_price`
- backend calculates `total_price`
- order status starts as `PENDING`
- `paymentStatus` is `PENDING` for this path; `razorpayOrderId` / `razorpayPaymentId` are null unless you used § 4.0
- **`notes`** cannot be changed after the order is created

**Success Response:**
```json
{
  "id": "d0b9fa9b-66c2-4c9b-9647-91c0019fdc1f",
  "client_id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
  "kitchen_id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
  "status": "PENDING",
  "paymentStatus": "PENDING",
  "razorpayOrderId": null,
  "razorpayPaymentId": null,
  "scheduled_for": "2026-02-16",
  "notes": null,
  "total_price": 280.00,
  "platform_fees": 10.00,
  "delivery_fees": 20.00,
  "items": [
    {
      "id": "305f804b-5161-4482-bce1-6fa2e5034d95",
      "food_item_id": "aebf865c-abf8-405b-9e5b-ab4fce869084",
      "quantity": 2,
      "snapshot_price": 100.00
    },
    {
      "id": "71e1bfb4-2576-4cee-ae04-69cb5a1eb4a8",
      "food_item_id": "e9663f29-718b-44d9-a8e9-eecf9dc6f68e",
      "quantity": 1,
      "snapshot_price": 50.00
    }
  ],
  "created_at": "2026-02-15T06:43:41.612Z",
  "updated_at": "2026-02-15T06:43:41.612Z"
}
```

`total_price` = items subtotal + `platform_fees` + `delivery_fees`

---

### 4.2 Get My Orders

**`GET /orders`**

Returns all orders created by authenticated client.

**Success Response:**
```json
[
  {
    "id": "d0b9fa9b-66c2-4c9b-9647-91c0019fdc1f",
    "status": "ACCEPTED",
    "scheduled_for": "2026-02-16",
    "notes": null,
    "total_price": 280.00,
    "platform_fees": 10.00,
    "delivery_fees": 20.00,
    "items": [
      {
        "food_item_id": "aebf865c-abf8-405b-9e5b-ab4fce869084",
        "name": "Pizza",
        "image_url": "https://nutri.s3.ap-south-1.amazonaws.com/uploads/e41b0fd1.jpg",
        "quantity": 2,
        "snapshot_price": 100.00
      },
      {
        "food_item_id": "e9663f29-718b-44d9-a8e9-eecf9dc6f68e",
        "name": "Burger",
        "image_url": "https://nutri.s3.ap-south-1.amazonaws.com/uploads/burger.jpg",
        "quantity": 1,
        "snapshot_price": 50.00
      }
    ],
    "kitchen": {
      "id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
      "name": "Arjuns Kitchen",
      "phone": "7738087085",
      "address": "123",
      "is_veg": true
    },
    "delivery_driver": null
  }
]
```

---

### 4.3 Get Order By ID

**`GET /orders/:id`**

Example:
`GET /orders/d0b9fa9b-66c2-4c9b-9647-91c0019fdc1f`

**Business Rules:**
- Client can only access their own orders
- 404 if not found
- 403 if not owner

**Success Response:**
```json
{
  "id": "d0b9fa9b-66c2-4c9b-9647-91c0019fdc1f",
  "status": "ACCEPTED",
  "scheduled_for": "2026-02-16",
  "notes": null,
  "total_price": 280.00,
  "platform_fees": 10.00,
  "delivery_fees": 20.00,
  "items": [
    {
      "food_item_id": "aebf865c-abf8-405b-9e5b-ab4fce869084",
      "name": "Pizza",
      "image_url": "https://nutri.s3.ap-south-1.amazonaws.com/uploads/e41b0fd1.jpg",
      "quantity": 2,
      "snapshot_price": 100.00
    },
    {
      "food_item_id": "e9663f29-718b-44d9-a8e9-eecf9dc6f68e",
      "name": "Burger",
      "image_url": "https://nutri.s3.ap-south-1.amazonaws.com/uploads/burger.jpg",
      "quantity": 1,
      "snapshot_price": 50.00
    }
  ],
  "kitchen": {
    "id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
    "name": "Arjuns Kitchen",
    "phone": "7738087085",
    "address": "123",
    "is_veg": true
  },
  "delivery_driver": {
    "id": "driver-uuid-123",
    "name": "Driver Name",
    "phone_number": "9876543210"
  }
}
```

---

### 4.4 Get delivery handoff OTP (show driver at door)

**`GET /orders/:id/delivery-handoff-otp`**

**Role:** `CLIENT` only.

Returns a **4-digit** code while the order is **`OUT_FOR_DELIVERY`**. The customer shows this to the delivery partner; the partner enters it in **`PATCH /deliveries/:id/finish`**.

**Success Response:**
```json
{
  "otp": "0427",
  "expires_in_seconds": 13842
}
```

**Errors:** `400` if status is not `OUT_FOR_DELIVERY`; `403` if the order belongs to another user.

---

### 4.5 Live map tracking (driver on map, ETA, route)

**`GET /orders/:id/tracking`**

**Role:** `CLIENT` only, and only while the order is **`PICKED_UP`** or **`OUT_FOR_DELIVERY`**.

Returns the driver’s last reported position, destination coordinates, and (when available) a Google **encoded polyline**, **distance**, **duration**, and **ETA**. Poll every **5–10 seconds** while the tracking screen is open.

Full integration notes (maps SDK keys, decoding polylines, `route_error`, profile coordinates): **[`Maps.md`](./Maps.md)** and [`api-reference.md`](./api-reference.md) § Orders → **Get order tracking**.

**Tip:** Set delivery **`latitude` / `longitude`** on **`PATCH /users/me`** so routing is reliable; see **Update Profile** in [`api-reference.md`](./api-reference.md).

---

## 5. REVIEWS & RATINGS

Clients give **1–5 star** ratings per **order line** (`order_item_id`). The order must be **`DELIVERED`**. There is **no deadline** after delivery; submitting again for the same line **updates** the stars.

**`GET /orders`** and **`GET /orders/:id`** (client) include each line’s **`order_item_id`**, **`is_rated`**, and **`rating`** (`null` or `{ "stars": <1–5> }`).

Kitchen-wide averages are **not** stored on the kitchen row; use **`GET /restaurants/:kitchenId/stats`** (same id as **`GET /kitchens/:id`**) for aggregates and distribution.

### 5.1 Rate or update a line item

**`POST /orders/:orderId/items/:itemId/rating`**

Requires: `Authorization: Bearer <CLIENT_JWT>`

**`:itemId`** = **`order_item_id`** from the order payload.

**Request Body:**
```json
{
  "stars": 5
}
```

**Business Rules:**
- The order must belong to you
- The line must belong to that order
- The order must be `DELIVERED`
- Integer **1–5** only

**Success Response:** Review row including `stars`, `created_at`, `updated_at`.

### 5.2 Get My Reviews

**`GET /reviews/my`**

Requires: `Authorization: Bearer <CLIENT_JWT>`

Returns a list of all your created reviews.

### 5.3 Get Reviews For a Food Item

**`GET /reviews/food-item/:foodItemId`**

Returns all reviews for a specific food item, ordered by creation date (descending). Each entry includes **`stars`**.

### 5.4 Get Reviews For a Kitchen

**`GET /reviews/kitchen/:kitchenId`**

Returns all reviews for a specific kitchen.

### 5.5 Restaurant / kitchen stats (public)

**`GET /restaurants/:kitchenId/stats`**

No auth. Returns **`total_orders`** (delivered), **`total_customers`**, **`average_rating`**, **`total_ratings`**, **`rating_distribution`**, and **`top_items`** (items with at least three ratings). See **`docs/api-reference.md`**.

---

## 6. TRANSACTIONS

Clients can view all credit transactions they were part of — whether credits were added/deducted by admin (SUPPORT), order payments, or refunds.

### 6.1 Get My Transactions

**`GET /transactions/my`**

Returns a paginated list of transactions where you were involved (as sender or receiver).

**Query Parameters:**
- `page` (number, optional): Page number. Default: 1.
- `limit` (number, optional): Items per page. Default: 20, Max: 100.

**Success Response:**
```json
{
  "data": [
    {
      "id": "txn-uuid",
      "short_id": "TXN-A1B2C3",
      "type": "CREDIT",
      "source": "SUPPORT",
      "amount": 500,
      "description": "Credits added by SUPPORT",
      "reference_id": null,
      "from": { "label": "SUPPORT" },
      "to": {
        "id": "user-uuid",
        "name": "Rahul Sharma",
        "username": "rahul01",
        "role": "CLIENT"
      },
      "created_at": "2026-03-02T17:25:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### 6.2 Get Transaction By ID

**`GET /transactions/:id`**

Returns a single transaction. You can only view transactions you were part of.

**Error Responses:**
- `403`: Transaction doesn't involve you
- `404`: Transaction not found

---

## ERROR RESPONSE FORMAT

Example Standard Error:

```json
{
  "statusCode": 400,
  "message": "Order must be scheduled for tomorrow",
  "error": "Bad Request"
}
```
