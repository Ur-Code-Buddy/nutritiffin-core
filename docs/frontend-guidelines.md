# Frontend Integration Guide for NutriTiffin

Base URL: https://backend.v1.nutritiffin.com

This document outlines how to integrate with the NutriTiffin backend, focusing on authentication, kitchen management, and image handling.

**Live delivery maps (customer + driver apps):** see **[`Maps.md`](./Maps.md)** for `GET /orders/:id/tracking`, `PATCH /deliveries/:id/location`, polling, and Google keys.

1. Authentication & User Registration

---

- Endpoint: POST /auth/register
- Fields:
  - username, password, role ('CLIENT' or 'KITCHEN_OWNER')
  - name (Full Name)
  - email (Unique)
  - phone_number (Unique)
- Flow:
  1. Collect all fields.
  2. Call register endpoint.
  3. On success, prompt the user to check their email to verify their account.
  4. The user clicks the link (`/auth/verify-email?token=...`) and is redirected back to `FRONTEND_URL/verification-success` or `verification-failed`.

- Endpoint: POST /auth/login
- Note: Users MUST be verified before they can log in. Unverified users will receive a 401 Unauthorized.
- Response: Returns `access_token`.
- Usage: Store `access_token` (localStorage/cookie) and send it in the `Authorization` header for all protected requests:
  `Authorization: Bearer <your_token>`

2. Kitchen Management (For Kitchen Owners)

---

- Create Kitchen: POST /kitchens
  - Fields: name, details, operating_hours.
  - Flags:
    - `is_active`: Set to `true` to make kitchen visible to public. Set `false` to hide it (e.g., closed for holidays).
    - `is_menu_visible`: Set to `true` to show menu. `false` hides menu but keeps kitchen profile visible.
    - `is_veg` (optional boolean): **`true`** = veg kitchen tag, **`false`** or omitted = non-veg (default).
  - Image: See "Image Upload" section below.

- Update Kitchen: PATCH /kitchens/:id
  - Send only fields that need changing.
  - Optional `is_veg` to change the veg / non-veg tag.
  - Optional `auto_accept_orders` (boolean): when `true`, new orders for this kitchen are saved as **ACCEPTED** without the owner tapping accept (see below).

- Auto-accept toggle: PATCH /kitchens/me/auto-accept-orders
  - Body: `{ "enabled": true }` or `{ "enabled": false }`.
  - Kitchen-owner only; resolves the kitchen from the JWT (one kitchen per owner).
  - When enabled, order flows (`POST /payments/confirm` or legacy `POST /orders`) return orders already **ACCEPTED**; the kitchen app can skip accept/reject for those and go straight to prep / **PATCH /orders/:id/ready** when appropriate.

- **Payout bank details (kitchen owner):** **GET** `/api/kitchen/bank-details` (returns saved row or `null`). **PATCH** `/api/kitchen/bank-details` — upsert `account_holder_name`, `account_number`, `ifsc_code`, `bank_name`; optional `upi_id`.

- **Withdrawal request (manual payout):** **POST** `/api/kitchen/withdraw` with `{ "amount": <INR>, "note": "optional" }`. Amount must be ≥ server **`MIN_KITCHEN_WITHDRAWAL_INR`** and ≤ **`GET /kitchens/credits`**. Bank details must exist first. Returns **200** with a success message; does **not** deduct wallet balance automatically. See **[`api-reference.md`](./api-reference.md)** § Kitchen payouts & withdrawals.

3. Image Upload Flow

---

Images (Kitchen cover, Menu items) are NOT sent directly in the Create/Update bodies. You must upload them first to get a URL.

- Endpoint: POST /upload-image
- Type: `multipart/form-data`
- Key: `file`
- Max Size: 5MB
- Formats: JPG, PNG

Step-by-Step Implementation:

1. User selects an image in your UI.
2. Frontend sends `POST /upload-image` with the file.
3. Backend returns `{ "image_url": "https://..." }`.
4. Frontend takes this `image_url` and sends it in the `create` or `update` request (e.g., as `image_url` field in `POST /kitchens` or `POST /menu-items`).

**Profile photo:** Use the same upload flow, then **`PATCH /users/me`** with `current_password`, `profile_picture_url` set to the returned URL. **`GET /users/me`** returns `profile_picture_url` (`null` if unset). Send `profile_picture_url: null` to remove.

5. Public Listing (For Clients)

---

- List Kitchens: GET /kitchens
  - Returns ONLY active kitchens (`is_active: true`).
  - Each kitchen includes **`is_veg`** for veg / non-veg badges in the UI.
  - Use this to display the main feed.

- View Kitchen: GET /kitchens/:id
  - Shows details. Check `is_menu_visible` before showing the menu list.
  - Includes **`is_veg`** (same semantics as create/update).

5. Orders

---

**Recommended (Razorpay advance payment — order saved only after successful pay):**

1. `POST /payments/initiate` — Same JSON as create order: `kitchen_id`, `scheduled_for` (`YYYY-MM-DD`, 1–3 days ahead), `items[]` (`food_item_id`, `quantity`). Returns `razorpayOrderId` + `publicKey` (use with Razorpay Checkout).
2. After the user pays, call `POST /payments/confirm` with `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`, and `originalDto` (must match step 1). Response is the created order (`paymentStatus: PAID`).

**Legacy (immediate create, no Razorpay):**

- `POST /orders` — Same body; order is persisted immediately (`paymentStatus` typically `PENDING`, no Razorpay ids).

**Order payloads:** **`GET /orders`** and **`GET /orders/:id`** include nested **`kitchen`** with **`is_veg`** (alongside `id`, `name`, `phone`, `address`).

**Tracking:**

- `GET /orders` — list; `GET /orders/:id` — detail (status: PENDING, ACCEPTED, READY, etc.).

Some kitchens use **auto-accept** (`auto_accept_orders` on `GET /kitchens/:id` or owner toggle). For those, the created order may already be **`ACCEPTED`** with **`accepted_at`** set; the client should not assume every new order starts as **PENDING**.

See also `docs/api.md` and `docs/api-reference.md` § Payments.

## Notes

- Handle 401 Unauthorized by redirecting to Login.
- Handle 409 Conflict (Duplicate Email/Phone) during registration by showing a user-friendly error.

6. Delivery Driver Dashboard

---

- Role: `DELIVERY_DRIVER`
- Flow:
  1. Login to get token.
  2. GET /deliveries/available -> Show list of orders kitchen has accepted.
  3. Driver clicks "Accept" -> PATCH /deliveries/:id/accept.
  4. Order moves to "Current Deliveries" (GET /deliveries/my-orders).
  5. Show details: Address (Client/Kitchen), Phone numbers, Total Price.
  6. After **out for delivery**, the **client** must call **`GET /orders/:id/delivery-handoff-otp`** and show the **4-digit** code to the driver.
  7. Driver finishes -> **`PATCH /deliveries/:id/finish`** with JSON body `{ "otp": "<4 digits>" }`.

7. Transaction History (All Roles)

---

Every user (Client, Kitchen Owner, Delivery Driver) can view their transaction history.

- Endpoint: GET /transactions/my
- Auth Required: Yes (any role)
- Query Params: `page` (default 1), `limit` (default 20, max 100)
- Response: Paginated list of transactions.

Key Integration Points:

1. **SUPPORT label**: When `source` is `SUPPORT` and `from` or `to` is null, show `{ "label": "SUPPORT" }`. Display this as "Support" or "Admin" in the UI instead of a user name.

2. **Delivery references**: When `source` is `DELIVERY`, the `description` mentions the delivery short ID (e.g. "Kitchen payout for delivery DEL-X9K2"). Use this to show context about what the transaction was for.

3. **Transaction types**:
   - `CREDIT` = money received (show as green/positive)
   - `DEBIT` = money deducted (show as red/negative)

4. **Reference linking**: `reference_id` contains the order UUID when applicable. You can link transactions to order details.

5. **Transaction short_id**: A human-readable ID like `TXN-A1B2C3` — use this for display in receipts and lists.

Flow:
  1. Call GET /transactions/my?page=1&limit=20
  2. Display each transaction with: short_id, type icon (+ or -), amount, description, date.
  3. For `from`/`to` fields: if it has `label` key, show "SUPPORT"; otherwise show user name.
  4. Implement pagination with "Load More" or page navigation.

Single Transaction Detail:
  - GET /transactions/:id
  - Non-admins can only view transactions they were part of (403 otherwise).

