# API Endpoints Documentation

## Base URL

All endpoints are relative to the base URL: `http://localhost:3000` (for local development).

---

## Authentication (`/auth`)

### Registration → Login Pipeline

New users must complete the following steps before they can log in:

```
1. Register        POST /auth/register
       ↓
2. Verify Email    GET  /auth/verify-email?token=...
       ↓            (verification email sent during registration)
3. OTP Sent        Automatic — 4-digit SMS OTP sent 10 seconds after email verification
       ↓            (can also be triggered manually via POST /auth/resend-phone-otp)
4. Verify Phone    POST /auth/verify-phone
       ↓            (user submits the 4-digit OTP received via SMS)
5. Login           POST /auth/login
                   (only allowed after both email and phone are verified)
```

> **Note:** In development mode (`PRODUCTION=false`), email and phone are auto-verified on registration and all OTP checks are bypassed.

### Register User

**POST** `/auth/register`

Creates a new user account.

**Request Body:**


| Field               | Type   | Required | Description                                                               |
| ------------------- | ------ | -------- | ------------------------------------------------------------------------- |
| `username`          | string | **Yes**  | Unique username.                                                          |
| `name`              | string | **Yes**  | Full name of the user.                                                    |
| `email`             | string | **Yes**  | Email address (unique).                                                   |
| `phone_number`      | string | **Yes**  | Phone number (unique).                                                    |
| `address`           | string | **Yes**  | Physical address of the user.                                             |
| `pincode`           | string | **Yes**  | PIN Code/Postal code.                                                     |
| `password`          | string | **Yes**  | Password (min 6 characters).                                              |
| `role`              | enum   | **Yes**  | User role. Values: `CLIENT`, `KITCHEN_OWNER`, `DELIVERY_DRIVER`, `ADMIN`. |
| `admin_access_pass` | string | No       | Required only if `role` is `ADMIN`.                                       |


**Response:** Returns a success message prompting the user to verify their email. A verification email is sent (placeholder for now).

### Login

**POST** `/auth/login`

Authenticates a user and returns a JWT token. **Rejects users who have not verified both their email and phone number.**

**Request Body:**


| Field      | Type   | Required | Description          |
| ---------- | ------ | -------- | -------------------- |
| `username` | string | **Yes**  | Registered username. |
| `password` | string | **Yes**  | User password.       |


### Verify Email

**GET** `/auth/verify-email?token=...`

Verifies a user's email address using the token sent during registration.

**Query Parameters:**


| Field   | Type   | Required | Description                            |
| ------- | ------ | -------- | -------------------------------------- |
| `token` | string | **Yes**  | The verification token from the email. |


**Behavior:**

- Looks up the user by the token.
- Returns a 302 Redirect to the frontend application:
  - On success: Redirects to `FRONTEND_URL/verification-success` (and sets `email_verified: true`, clears token). **A 4-digit SMS OTP is automatically sent to the user's phone number after a 10-second delay.**
  - On invalid token: Redirects to `FRONTEND_URL/verification-failed?reason=invalid`.
  - On expired token (tokens are valid for 24 hours): Redirects to `FRONTEND_URL/verification-failed?reason=expired`.

### Resend Verification Email

**POST** `/auth/resend-verification`

Regenerates a verification token and resends the verification email.

**Request Body:**


| Field   | Type   | Required | Description                                    |
| ------- | ------ | -------- | ---------------------------------------------- |
| `email` | string | **Yes**  | The email address associated with the account. |


**Behavior:**

- Returns `404` if no account is found with the provided email.
- Returns `400` if the email is already verified.
- Generates a new token (valid for 24 hours) and sends a verification email.

### Retry Email Login

**POST** `/auth/retry-email-login`

Retries sending the verification email for login. This functions identically to the resend verification endpoint.

**Request Body:**


| Field   | Type   | Required | Description                                    |
| ------- | ------ | -------- | ---------------------------------------------- |
| `email` | string | **Yes**  | The email address associated with the account. |


**Behavior:**

- Returns `404` if no account is found with the provided email.
- Returns `400` if the email is already verified.
- Generates a new token (valid for 24 hours) and sends a verification email.
- Has a rate limit: max 1 request every 30 seconds.

### Check if Email Verified

**POST** `/auth/check-email-verified`

Checks whether the provided email is verified. Has a rate limit: max 1 request every 10 seconds.

**Request Body:**


| Field   | Type   | Required | Description                 |
| ------- | ------ | -------- | --------------------------- |
| `email` | string | **Yes**  | The email address to check. |


**Response:**

```json
{
  "is_verified": true
}
```

### Delete Account

**POST** `/auth/delete-account`
**Role Required:** Authenticated User

Deletes the connected authenticated user account from the system permanently.

**Response:** Returns a success message.

### Forgot Password

**POST** `/auth/forgot-password`

Initiates the password reset flow. Checks if the account exists, generates a 6-digit OTP stored in Redis (10 minutes expiry), and emails the OTP.

**Request Body:**


| Field   | Type   | Required | Description                                    |
| ------- | ------ | -------- | ---------------------------------------------- |
| `email` | string | **Yes**  | The email address associated with the account. |


**Response:** Returns a generic success message to prevent user enumeration.

### Reset Password

**POST** `/auth/reset-password`

Completes the password reset process by verifying the emailed OTP against Redis and saving the new password hash. Immediately bumps the token version, forcing re-authentication everywhere.

**Request Body:**


| Field          | Type   | Required | Description                          |
| -------------- | ------ | -------- | ------------------------------------ |
| `email`        | string | **Yes**  | The user's email address.            |
| `otp`          | string | **Yes**  | The 6-digit OTP from the email.      |
| `new_password` | string | **Yes**  | The new password (min 6 characters). |


**Response:** Returns a success message.

### Request Phone OTP (Resend / Registration)

**POST** `/auth/resend-phone-otp`

Integrates with the **MessageCentral CPaaS API** to send a 4-digit SMS OTP to a phone number via a `POST` request. The returned `verificationId` is stored temporarily in Redis (5 minutes TTL).

> **Note:** This endpoint is also called automatically 10 seconds after successful email verification. Users can call it manually to resend the OTP if needed.

**Request Body:**


| Field   | Type   | Required | Description          |
| ------- | ------ | -------- | -------------------- |
| `phone` | string | **Yes**  | Target phone number. |


**Response:**

```json
{
  "message": "OTP sent successfully"
}
```

### Verify Phone OTP

**POST** `/auth/verify-phone`

Validates the 4-digit SMS OTP against the MessageCentral API using a `GET` request with the stored `verificationId` and the user-provided OTP code. On success, marks the user's account as `phone_verified = true`. This is the final step before the user can log in.

**Request Body:**


| Field   | Type   | Required | Description                      |
| ------- | ------ | -------- | -------------------------------- |
| `phone` | string | **Yes**  | The phone number being verified. |
| `otp`   | string | **Yes**  | The code entered by the user.    |


**Response:**

```json
{
  "message": "Phone number verified successfully",
  "verified": true
}
```

---

## Users & Administration (`/users` & `/admin`)

### Check Username Availability

**GET** `/users/check-username/:username`

Checks whether a username is already registered. This is a **public endpoint** (no authentication required) with strict rate limiting.

**Rate Limits:**

- **10 requests per minute**
- **25 requests per hour**

**Path Parameters:**


| Field      | Type   | Required | Description            |
| ---------- | ------ | -------- | ---------------------- |
| `username` | string | **Yes**  | The username to check. |


**Response:**

```json
{
  "exists": true
}
```

### Get Current User Profile

**GET** `/users/me`
**Role Required:** Authenticated User

Retrieves the profile of the currently logged-in user, including their Rupee `credits` balance.

### Update Profile

**PATCH** `/users/me`
**Role Required:** Authenticated User

Updates the authenticated user's profile. Requires the current password for security verification. A notification email is sent to the user after the profile is updated.

**Request Body:**


| Field              | Type   | Required | Description                                                        |
| ------------------ | ------ | -------- | ------------------------------------------------------------------ |
| `current_password` | string | **Yes**  | The user's current password (verified before changes are applied). |
| `address`          | string | No       | Updated address.                                                   |
| `phone_number`     | string | No       | Updated phone number.                                              |
| `pincode`          | string | No       | Updated pincode.                                                   |


**Behavior:**

- Verifies the `current_password` against the stored hash. Returns `401 Unauthorized` if incorrect.
- Only updates fields that are provided **and** differ from the current values.
- If `phone_number` changes:
  - Checks uniqueness (returns `409 Conflict` if already taken by another user).
  - Resets `phone_verified` to `false`.
  - Automatically sends a 4-digit SMS OTP to the new phone number.
  - The user must verify the new phone number via `POST /auth/verify-phone` before logging in again.
- A notification email is sent to the user listing the fields that were changed.
- If no fields differ, the profile is returned unchanged (no email is sent).

**Response:**

```json
{
  "message": "Profile updated successfully. An OTP has been sent to your new phone number for verification.",
  "phone_verification_required": true,
  "user": {
    "id": "user-uuid",
    "username": "john_doe",
    "name": "John Doe",
    "email": "john@example.com",
    "phone_number": "9876543210",
    "address": "New Address",
    "pincode": "400001",
    "role": "CLIENT",
    "credits": 500,
    "phone_verified": false
  }
}
```

### Get All Users

**GET** `/admin/users`
**Role Required:** `ADMIN`

Retrieves a list of all registered users and their credit balances.

### Search Users

**GET** `/admin/users/search?q=:query`
**Role Required:** `ADMIN`

Search users by username, name, or email with a partial match query. Useful when the user table grows too large to list everyone efficiently.

**Response:**

```json
[
  {
    "id": "3a22...",
    "username": "john_doe",
    "credits": 1250,
    "status": "active"
  }
]
```

### Get User Credits

**GET** `/admin/users/credits/:username`
**Role Required:** `ADMIN`

Look up a specific user's credit balance quickly, including their last transaction date, without fetching the entire user list.

**Response:**

```json
{
  "username": "john_doe",
  "credits": 1250,
  "last_transaction": "2026-03-06T14:30:00Z"
}
```

### Get Platform Stats

**GET** `/admin/stats`
**Role Required:** `ADMIN`

Return a quick summary/dashboard of the entire platform metrics in one call, reducing the need for multiple expensive queries.

**Response:**

```json
{
  "total_users": 142,
  "active_users": 98,
  "disabled_users": 3,
  "total_credits_in_circulation": 45200,
  "active_kitchens": 2,
  "pending_deliveries": 12,
  "completed_deliveries_today": 47,
  "transactions_today": 63
}
```

### Add User Credits

**POST** `/admin/credits/add`
**Role Required:** `ADMIN`

Adds integer credits (Rupees) to a specific user's account. **A transaction record is automatically cre**

```markdown
/is-my-district-available
```

**ated.**

**Request Body:**


| Field      | Type   | Required | Description                      |
| ---------- | ------ | -------- | -------------------------------- |
| `username` | string | **Yes**  | Username of the user.            |
| `credits`  | number | **Yes**  | Integer amount of Rupees to add. |


**Response:**

```json
{
  "message": "Added 500 credits to john_doe",
  "credits": 1500,
  "transaction": {
    "id": "txn-uuid",
    "short_id": "TXN-A1B2C3"
  }
}
```

### Deduct User Credits

**POST** `/admin/credits/deduct`
**Role Required:** `ADMIN`

Deducts integer credits (Rupees) from a specific user's account. Fails if user has insufficient credits. **A transaction record is automatically created.**

**Request Body:** Same as Add User Credits.

**Response:**

```json
{
  "message": "Deducted 200 credits from john_doe",
  "credits": 1300,
  "transaction": {
    "id": "txn-uuid",
    "short_id": "TXN-D4E5F6"
  }
}
```

### Disable User

**POST** `/admin/users/:id/disable`
**Role Required:** `ADMIN`

Deactivates a user account (Client, Kitchen Owner, or Delivery Driver).

### Enable User

**POST** `/admin/users/:id/enable`
**Role Required:** `ADMIN`

Reactivates a previously disabled user account.

---

## Kitchens (`/kitchens`)

### Create Kitchen

**POST** `/kitchens`
**Role Required:** `KITCHEN_OWNER`

Creates a new kitchen profile for the authenticated user.

**Request Body:**


| Field             | Type    | Required | Description                                           |
| ----------------- | ------- | -------- | ----------------------------------------------------- |
| `name`            | string  | **Yes**  | Name of the kitchen.                                  |
| `details`         | object  | No       | Additional details (address, phone, description).     |
| `operating_hours` | object  | No       | Operating hours configuration (Times in **HH:MM**).   |
| `image_url`       | string  | No       | URL to the kitchen's cover image.                     |
| `is_active`       | boolean | No       | Whether the kitchen is active (default: true).        |
| `is_menu_visible` | boolean | No       | Whether the menu is visible to users (default: true). |


### Get Kitchen Credits

**GET** `/kitchens/credits`
**Role Required:** `KITCHEN_OWNER`

Retrieves the current available credit balance for the authenticated kitchen owner.

### Get All Kitchens

**GET** `/kitchens`

Retrieves a list of all active kitchens.

### Get Kitchen by ID

**GET** `/kitchens/:id`

Retrieves details of a specific kitchen.

### Update Kitchen

**PATCH** `/kitchens/:id`
**Role Required:** `KITCHEN_OWNER`

Updates an existing kitchen profile.

**Request Body:**
Partial of **Create Kitchen** body.

---

## Menu Items (`/menu-items`)

### Create Menu Item

**POST** `/menu-items`
**Role Required:** `KITCHEN_OWNER`

Adds a new food item to the user's kitchen menu.

**Request Body:**


| Field               | Type   | Required | Description                                                       |
| ------------------- | ------ | -------- | ----------------------------------------------------------------- |
| `name`              | string | **Yes**  | Name of the dish.                                                 |
| `price`             | number | **Yes**  | Price of the dish.                                                |
| `description`       | string | No       | Description of the dish.                                          |
| `image_url`         | string | No       | URL to the dish image.                                            |
| `max_daily_orders`  | number | No       | Maximum number of orders allowed per day.                         |
| `availability_days` | array  | No       | List of days the item is available (e.g. `["monday", "friday"]`). |


### Get My Items

**GET** `/menu-items/my-items`
**Role Required:** `KITCHEN_OWNER`

Retrieves all menu items for the authenticated kitchen owner.

### Get Menu Items by Kitchen

**GET** `/menu-items/kitchen/:kitchenId`

Retrieves all menu items for a specific kitchen.

### Get Menu Item by ID

**GET** `/menu-items/:id`

Retrieves details of a specific menu item.

### Update Menu Item

**PATCH** `/menu-items/:id`
**Role Required:** `KITCHEN_OWNER`

Updates a menu item.

**Request Body:**
Partial of **Create Menu Item** body.

### Set Menu Item Availability

**PATCH** `/menu-items/:id/availability`
**Role Required:** `KITCHEN_OWNER`

Sets the availability of a specific item.

**Request Body:**


| Field          | Type    | Required | Description                             |
| -------------- | ------- | -------- | --------------------------------------- |
| `is_available` | boolean | **Yes**  | `true` if available, `false` otherwise. |


---

## Orders (`/orders`)

### Create Order

**POST** `/orders`
**Role Required:** `CLIENT`

Places a new order **immediately** (saved to the database on success). Does not go through Razorpay.

For **advance payment** before persisting the order, use `**POST /payments/initiate`** then `**POST /payments/confirm`** (see [Payments (`/payments`)](#payments-payments) below).

**Request Body:**


| Field           | Type   | Required | Description                                                             |
| --------------- | ------ | -------- | ----------------------------------------------------------------------- |
| `kitchen_id`    | string | **Yes**  | ID of the kitchen to order from.                                        |
| `scheduled_for` | string | **Yes**  | Date for the order in `YYYY-MM-DD` format. Must be 1-3 days in advance. |
| `items`         | array  | **Yes**  | List of items to order.                                                 |


**Item Object (in `items` array):**


| Field          | Type   | Required | Description                |
| -------------- | ------ | -------- | -------------------------- |
| `food_item_id` | string | **Yes**  | ID of the menu item.       |
| `quantity`     | number | **Yes**  | Quantity to order (min 1). |


**Order payment fields (on saved orders):**


| Field               | Type   | Description                                                               |
| ------------------- | ------ | ------------------------------------------------------------------------- |
| `paymentStatus`     | enum   | `PENDING` (e.g. legacy `POST /orders`) or `PAID` (Razorpay confirm path). |
| `razorpayOrderId`   | string | null                                                                      |
| `razorpayPaymentId` | string | null                                                                      |
| `refund_status`     | enum   | `NOT_APPLICABLE` (unpaid / no refund), `PENDING` (refund initiated), `COMPLETED`, `FAILED`. |
| `razorpay_refund_id`| string | Razorpay refund id when a refund was created; otherwise null.              |
| `refund_initiated_at` | string (ISO) | When the refund was requested; null if none.                          |
| `refund_expected_by` | string | `YYYY-MM-DD` (UTC calendar); use for “expect by” copy (e.g. 5–7 business days after initiation). Null if not applicable. |


### Get All Orders

**GET** `/orders`
**Role Required:** Authenticated User

Retrieves all orders for the authenticated user (Client or Kitchen Owner) with role-specific details.

### Get Order by ID

**GET** `/orders/:id`
**Role Required:** Authenticated User

Retrieves details of a specific order.

**Response:**

```json
{
  "id": "order-uuid",
  "status": "ACCEPTED",
  "scheduled_for": "2026-02-16",
  "total_price": 250.0,
  "kitchen": {
    "id": "kitchen-id",
    "name": "Kitchen Name",
    "phone": "...",
    "address": "..."
  },
  "items": [
    {
      "food_item_id": "item-id",
      "name": "Item Name",
      "image_url": "http://...",
      "quantity": 2,
      "snapshot_price": 100.0
    }
  ],
  "delivery_driver": {
    "id": "driver-uuid",
    "name": "Driver Name",
    "phone_number": "9876543210"
  },
  "paymentStatus": "PAID",
  "razorpayOrderId": "order_...",
  "razorpayPaymentId": "pay_...",
  "refund_status": "NOT_APPLICABLE",
  "razorpay_refund_id": null,
  "refund_initiated_at": null,
  "refund_expected_by": null
}
```

When a **paid** order is **rejected** (kitchen reject or auto timeout), the backend creates a **full Razorpay refund**, sets `refund_status` to `PENDING`, and fills `refund_expected_by` (7 business days after initiation, UTC). The client receives a push notification with refund messaging. Unpaid (legacy) orders get `refund_status` `NOT_APPLICABLE`.

### Accept Order

**PATCH** `/orders/:id/accept`
**Role Required:** `KITCHEN_OWNER`

Marks an order as `ACCEPTED`.

### Mark Order Ready

**PATCH** `/orders/:id/ready`
**Role Required:** `KITCHEN_OWNER`

Marks an order as `READY` for pickup.

### Reject Order

**PATCH** `/orders/:id/reject`
**Role Required:** `KITCHEN_OWNER`

Marks an order as `REJECTED`. If the order was **paid** via Razorpay, the server **initiates a full refund** and updates `refund_status`, `razorpay_refund_id`, `refund_initiated_at`, and `refund_expected_by`. A **push notification** is sent to the customer (including refund copy when applicable).

---

## Payments (`/payments`)

Razorpay **advance payment** flow: validates the cart like order creation, creates a Razorpay order, then **persists the `Order` only after** signature verification and a successful `captured` payment fetch from Razorpay.

**Environment:** `RAZORPAY_API_KEY`, `RAZORPAY_KEY_SECRET` (server-side only for secret).

### Initiate payment (create Razorpay order)

**POST** `/payments/initiate`
**Role Required:** `CLIENT`

Runs the same validations as **Create Order** (schedule window, item availability, sold-out checks, fees) but **does not** insert an `Order` row.

**Request Body:** Same as **Create Order** (`kitchen_id`, `scheduled_for`, `items[]`).

**Response:**


| Field             | Type   | Description                                       |
| ----------------- | ------ | ------------------------------------------------- |
| `razorpayOrderId` | string | Razorpay order id (`order_...`) for Checkout.     |
| `publicKey`       | string | Key id from `RAZORPAY_API_KEY` (safe for client). |


### Confirm payment (save order)

**POST** `/payments/confirm`
**Role Required:** `CLIENT`

**Request Body:**


| Field               | Type   | Required | Description                                                            |
| ------------------- | ------ | -------- | ---------------------------------------------------------------------- |
| `razorpayOrderId`   | string | **Yes**  | Must match the order id from initiate.                                 |
| `razorpayPaymentId` | string | **Yes**  | Razorpay payment id after successful pay.                              |
| `razorpaySignature` | string | **Yes**  | HMAC SHA256 of `razorpayOrderId                                        |
| `originalDto`       | object | **Yes**  | Same body as **Create Order** (must match what was used for initiate). |


**Response:** Created `Order` entity (same as **Create Order**), with `paymentStatus: PAID` and Razorpay ids set.

**Errors:** `400 Bad Request` if signature invalid, payment not `captured`, payment/order mismatch, amount mismatch vs server quote, or order validation fails.

---

## Uploads (`/upload-image`)

### Upload Image

**POST** `/upload-image`

Uploads an image file to S3 and returns the public URL.

**Request:**

- **Content-Type**: `multipart/form-data`
- **Body**: form-data with key `file` containing the image file (jpg/png, max 5MB).

---

## App General

### Check District Availability

**GET** `/is-my-district-available`

Checks whether a specific pincode is within the allowed delivery areas. This is a **public endpoint** and is backed by a database.

**Query Parameters:**


| Field     | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `pincode` | string | **Yes**  | The 6-digit pincode to check. |


**Response:**
`true` if the pincode is allowed, `false` otherwise.

### Add Allowed Pincode

**POST** `/is-my-district-available`
**Role Required:** `ADMIN`

Adds a new pincode to the list of deliverable areas.

**Request Body:**


| Field     | Type   | Required | Description         |
| --------- | ------ | -------- | ------------------- |
| `pincode` | number | **Yes**  | The pincode to add. |


**Response:**
Returns the created/updated `AllowedPincode` object.

### Remove Allowed Pincode

**DELETE** `/is-my-district-available/:pincode`
**Role Required:** `ADMIN`

Deactivates a pincode from the delivery areas.

**Path Parameters:**


| Field     | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| `pincode` | number | **Yes**  | The pincode to remove. |


**Response:**
`{ "success": true }`

### Get Platform Charges

**GET** `/charges`

Returns the current platform-wide charges and fees.

**Response:**

```json
{
  "platform_fees": 10,
  "kitchen_fees": 15,
  "delivery_fees": 20
}
```

### Maintenance mode

**GET** `/is_under_maintainance`

Public. Returns whether the app should treat the platform as under maintenance (for splash screens, read-only banners, etc.). State is stored in Redis under `nutri:maintenance_until`.

**Query parameters (optional):**


| Field   | Type   | Required | Description                                                                                                                                                                                                                                                                 |
| ------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hours` | number | No       | If **greater than 0**, the response is `true` only when maintenance is on **and** a scheduled end exists with **at least** that many hours remaining. If maintenance is on with a very long / indefinite end (POST with no duration), the flag stays `true` for this check. |
| `time`  | number | No       | Same meaning as `hours` (use one or the other; `hours` wins if both are sent).                                                                                                                                                                                              |


**Default when Redis has no key:** `is_under_maintainance` is `**false`** (normal operation) until an admin turns maintenance on via **POST**.

**Response (example when off):**

```json
{
  "is_under_maintainance": false,
  "maintenance_ends_at": null
}
```

**Response (example when on with a scheduled end):**

```json
{
  "is_under_maintainance": true,
  "maintenance_ends_at": "2026-03-24T12:00:00.000Z"
}
```

- `maintenance_ends_at` is `null` when maintenance is off. When on via **POST** without a specific hour count, the backend still stores a far-future end time, so `maintenance_ends_at` may be a distant ISO timestamp.

---

**POST** `/is_under_maintainance`

**Role required:** `ADMIN` (JWT `Authorization: Bearer …`).

Sets maintenance mode in Redis.

**Content-Type:** `application/json`

**Request body:**


| Field                   | Type    | Required | Description                                                                                                                                                                                 |
| ----------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_under_maintainance` | boolean | **Yes**  | `false` → maintenance **off**. `true` → maintenance **on** (see optional duration below).                                                                                                   |
| `hours`                 | number  | No       | When `is_under_maintainance` is `true`: if **> 0**, maintenance lasts that many hours from now. Omit or `**0`** → on until a far-future end (effectively indefinite). Ignored when `false`. |
| `time`                  | number  | No       | Same as `hours`; `**hours` wins** if both are sent.                                                                                                                                         |


**Examples**

Turn maintenance off:

```json
{ "is_under_maintainance": false }
```

Turn maintenance on for 3 hours:

```json
{ "is_under_maintainance": true, "hours": 3 }
```

Turn maintenance on with no fixed duration (stored as a long default end time):

```json
{ "is_under_maintainance": true }
```

**Response:** Same shape as **GET** (`is_under_maintainance`, `maintenance_ends_at`) reflecting the state after the update.

### Health Check

**GET** `/health`

Returns the API health status.

### Uptime

**GET** `/uptime`

Returns the current version and uptime.

### Root

**GET** `/`

Returns a welcome message.

### Reset Database

**POST** `/resetdb`

Resets the database. Requires superadmin access.

**Request Body:**


| Field  | Type   | Required | Description                                                                              |
| ------ | ------ | -------- | ---------------------------------------------------------------------------------------- |
| `pass` | string | **Yes**  | Super admin access password matching the `SUPER_ADMIN_ACCESS_PASS` environment variable. |


**Response:**
Returns a success message with the command execution output.

---

## Public statistics (`/api/v1/stats`)

Aggregated counts for marketing or landing pages. **Not real-time:** values are served from **Redis** (refreshed about every **15 minutes** and on a cache miss with single-flight locking). The database is not queried on every request.

**Rate limiting:** **20 requests per minute per IP** on this route (`publicStats` throttler). This limit applies even when `PRODUCTION=false` (unlike most other endpoints).

**Paths:** The API registers **two explicit routes** on the root router: `GET /v1/stats/public` and `GET /api/v1/stats/public`. Use whichever path your reverse proxy forwards to the Node process (many setups strip `/api`, so the app sees `/v1/stats/public`).

### Get public stats

**GET** `/v1/stats/public` **or** **GET** `/api/v1/stats/public`

**Auth:** None (public).

**Response:**

```json
{
  "number_of_active_clients": 1204,
  "number_of_active_kitchens": 87,
  "number_of_active_delivery_partners": 340,
  "number_of_orders_fulfilled": 52891,
  "as_of": "2026-03-23T10:00:00.000Z"
}
```

**Fields:**


| Field | Type | Description |
| ----- | ---- | ----------- |
| `number_of_active_clients` | number | Users with role `CLIENT`, `is_active: true`, `is_banned: false` (soft-deleted users excluded). |
| `number_of_active_kitchens` | number | Kitchens with `is_active: true` (soft-deleted kitchens excluded). |
| `number_of_active_delivery_partners` | number | Users with role `DELIVERY_DRIVER`, `is_active: true`, `is_banned: false`. |
| `number_of_orders_fulfilled` | number | Orders with `status: DELIVERED`. |
| `as_of` | string | ISO 8601 timestamp when the counts were computed (when the cached payload was built). |

**Implementation notes:**

- Redis key: `stats:public:v1`, TTL **900 seconds** (15 minutes).
- A background refresh runs on an interval of the same length; startup also warms the cache once.
- If Redis is unavailable, the API may compute counts directly from the database for that request (logged as a warning).

---

## Deliveries (`/deliveries`)

### Get Driver Credits

**GET** `/deliveries/credits`
**Role Required:** `DELIVERY_DRIVER`

Retrieves the current available credit balance for the authenticated delivery driver.

### Get Available Deliveries

**GET** `/deliveries/available`
**Role Required:** `DELIVERY_DRIVER`

Retrieves a list of orders that are `ACCEPTED` or `READY` for pickup.

### Get My Deliveries

**GET** `/deliveries/my-orders`
**Role Required:** `DELIVERY_DRIVER`

Retrieves a list of orders assigned to the authenticated driver.

### Accept Delivery

**PATCH** `/deliveries/:id/accept`
**Role Required:** `DELIVERY_DRIVER`

Assigns the order to the driver.

### Pick Up Delivery

**PATCH** `/deliveries/:id/pick-up`
**Role Required:** `DELIVERY_DRIVER`

Updates status to `PICKED_UP`.

### Out For Delivery

**PATCH** `/deliveries/:id/out-for-delivery`
**Role Required:** `DELIVERY_DRIVER`

Updates status to `OUT_FOR_DELIVERY`.

### Finish Delivery

**PATCH** `/deliveries/:id/finish`
**Role Required:** `DELIVERY_DRIVER`

Updates status to `DELIVERED`.

### Get Order Details

**GET** `/deliveries/:id`
**Role Required:** `DELIVERY_DRIVER` or `ADMIN`

Retrieves full order details. Depending on the user's role, the shape of the response differs.

**Response for Delivery Driver:**

```json
{
  "id": "order-uuid",
  "status": "OUT_FOR_DELIVERY",
  "total_price": 250.00,
  "kitchen": { ... },
  "client": {
     "name": "Client Name",
     "phone_number": "...",
     "address": "..."
  },
  "items": [ ... ]
}
```

**Response for Admin:**

```json
{
  "id": "del_001",
  "user": "john_doe",
  "kitchen": "Main Kitchen",
  "status": "IN_TRANSIT",
  "items": ["Paneer Tiffin x1", "Extra Roti x2"],
  "driver": "Ravi",
  "destination": "Andheri West, Mumbai",
  "estimated_delivery": "2026-03-06T13:00:00Z",
  "created_at": "2026-03-06T11:30:00Z"
}
```

---

## Reviews (`/reviews`)

Clients can add reviews for individual `order_items` that belong to an order that has been `DELIVERED` within the last 24 hours. A review is marked as either a thumbs up (`positive_count`) or thumbs down (`negative_count`).

### Add a Review

**POST** `/reviews`
**Role Required:** `CLIENT`

Creates a review for a specific ordered item.

**Request Body:**


| Field           | Type    | Required | Description                                                    |
| --------------- | ------- | -------- | -------------------------------------------------------------- |
| `order_item_id` | string  | **Yes**  | ID of the specific order item being reviewed.                  |
| `is_positive`   | boolean | **Yes**  | `true` for positive (upvote), `false` for negative (downvote). |


**Response:**

```json
{
  "id": "review-uuid",
  "client_id": "client-uuid",
  "kitchen_id": "kitchen-uuid",
  "food_item_id": "item-uuid",
  "order_id": "order-uuid",
  "order_item_id": "order-item-uuid",
  "is_positive": true,
  "created_at": "2026-03-05T20:10:00.000Z"
}
```

### Get My Reviews

**GET** `/reviews/my`
**Role Required:** `CLIENT`

Retrieves all reviews made by the authenticated client.

### Get Reviews by Food Item

**GET** `/reviews/food-item/:foodItemId`

Retrieves all reviews associated with a specific food item.

### Get Reviews by Kitchen

**GET** `/reviews/kitchen/:kitchenId`

Retrieves all reviews associated with a specific kitchen.

---

## Transactions (`/transactions`)

The transactions system tracks **every credit movement** in the system — admin add/deduct, delivery payouts, order payments. Every role can view the transactions they were part of.

### Get My Transactions

**GET** `/transactions/my`
**Role Required:** Authenticated User (any role)

Returns a paginated list of all transactions the authenticated user was involved in (as sender or receiver).

**Query Parameters:**


| Field   | Type   | Required | Description                             |
| ------- | ------ | -------- | --------------------------------------- |
| `page`  | number | No       | Page number (default: 1).               |
| `limit` | number | No       | Items per page (default: 20, max: 100). |


**Response:**

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
    },
    {
      "id": "txn-uuid-2",
      "short_id": "TXN-D4E5F6",
      "type": "CREDIT",
      "source": "DELIVERY",
      "amount": 20,
      "description": "Delivery payout for DEL-X9K2",
      "reference_id": "order-uuid",
      "from": null,
      "to": {
        "id": "driver-uuid",
        "name": "Driver Name",
        "username": "driver01",
        "role": "DELIVERY_DRIVER"
      },
      "created_at": "2026-03-02T18:00:00.000Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

### Get Transaction by ID

**GET** `/transactions/:id`
**Role Required:** Authenticated User

Retrieves a single transaction. Non-admin users can only view transactions they are a part of (as `from_user` or `to_user`).

**Response:** Same structure as a single item in the `data` array above.

**Error Responses:**

- `403 Forbidden`: If the transaction doesn't involve the authenticated user.
- `404 Not Found`: If the transaction ID is invalid.

### Get All Transactions (Admin)

**GET** `/transactions`
**Role Required:** `ADMIN`

Returns all transactions in the system (paginated).

**Query Parameters:** Same as Get My Transactions.

**Response:** Same structure as Get My Transactions.

### Get User Transaction History (Admin)

**GET** `/admin/transactions/user/:username`
**Role Required:** `ADMIN`

Get the transaction history for a specific user to easily view their spending patterns or audit their account for dispute resolution.

**Response:**

```json
[
  { 
    "id": "txn_abc", 
    "type": "credit", 
    "credits": 500, 
    "reason": "support", 
    "date": "2026-03-06T10:00:00Z" 
  },
  { 
    "id": "txn_def", 
    "type": "debit", 
    "credits": 120, 
    "reason": "order", 
    "date": "2026-03-06T12:30:00Z" 
  }
]
```

---

### Transaction Data Enums

#### Transaction Type


| Value    | Description                       |
| -------- | --------------------------------- |
| `CREDIT` | Credits were added to a user      |
| `DEBIT`  | Credits were deducted from a user |


#### Transaction Source


| Value      | Description                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `SUPPORT`  | Admin manually added/deducted credits. Shown as "SUPPORT" in `from`/`to` fields.                   |
| `DELIVERY` | Payment related to a delivery (kitchen/driver payout). Description mentions the delivery short ID. |
| `ORDER`    | Payment related to order placement or refund.                                                      |


### Transaction `from` / `to` Fields

- When a real user is involved, the field contains: `{ id, name, username, role }`
- When the system (admin/support) is involved and no user is set, the field shows: `{ "label": "SUPPORT" }`
- Otherwise: `null`

