# API Endpoints Documentation

## Base URL

All endpoints are relative to the base URL: `http://localhost:3000` (for local development).

**Companion docs:** **[`ratings.md`](./ratings.md)** (star ratings, `GET /reviews/*` shapes, restaurant stats narrative), **[`Maps.md`](./Maps.md)** (live tracking), **[`api.md`](./api.md)** (Razorpay initiate/confirm quick path), per-role flows in **`role-*.md`**.

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

Response includes `profile_picture_url` (`string` or `null`) — a full **https** (or **http**) URL to the user’s avatar image (for example after upload via **`POST /upload-image`**).

### Update Profile

**PATCH** `/users/me`
**Role Required:** Authenticated User

Updates the authenticated user's profile. Requires the current password for security verification. A notification email is sent to the user after the profile is updated.

**Request Body:**


| Field                   | Type           | Required | Description                                                                 |
| ----------------------- | -------------- | -------- | --------------------------------------------------------------------------- |
| `current_password`      | string         | **Yes**  | The user's current password (verified before changes are applied).          |
| `address`               | string         | No       | Updated address.                                                            |
| `phone_number`          | string         | No       | Updated phone number.                                                       |
| `pincode`               | string         | No       | Updated pincode.                                                            |
| `latitude`              | number \| null | No       | Delivery pin (WGS84). Send **`null`** to clear. Used for live route/ETA.    |
| `longitude`             | number \| null | No       | Delivery pin (WGS84). Send **`null`** to clear.                             |
| `profile_picture_url`   | string \| null | No       | Full **http** or **https** URL (max 2048 chars). Send **`null`** to remove. |


**Behavior:**

- Verifies the `current_password` against the stored hash. Returns `401 Unauthorized` if incorrect.
- Only updates fields that are provided **and** differ from the current values.
- If `phone_number` changes:
  - Checks uniqueness (returns `409 Conflict` if already taken by another user).
  - Resets `phone_verified` to `false`.
  - Automatically sends a 4-digit SMS OTP to the new phone number.
  - The user must verify the new phone number via `POST /auth/verify-phone` before logging in again.
- A notification email is sent to the user listing the fields that were changed (including **Profile picture** when `profile_picture_url` changes).
- If no fields differ, the profile is returned unchanged (no email is sent).
- Invalid `profile_picture_url` values return **`400 Bad Request`** (must be a valid http(s) URL when not `null`).

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
    "profile_picture_url": "https://bucket.s3.region.amazonaws.com/uploads/abc.jpg",
    "role": "CLIENT",
    "credits": 500,
    "phone_verified": false
  }
}
```

Order and delivery API responses that embed **`client`** or **`delivery_driver`** user summaries also include `profile_picture_url` when present.

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
| `latitude`        | number  | No       | Pickup location (WGS84) for driver navigation / tracking. |
| `longitude`       | number  | No       | Pickup location (WGS84).                              |
| `is_active`       | boolean | No       | Whether the kitchen is active (default: true).        |
| `is_menu_visible` | boolean | No       | Whether the menu is visible to users (default: true). |
| `is_veg`          | boolean | No       | Kitchen tag: **`true`** = veg, **`false`** = non-veg (default: **`false`** if omitted). |
| `auto_accept_orders` | boolean | No    | If `true`, new orders for this kitchen are persisted as **ACCEPTED** (see [Orders](#orders-orders)). Default `false`. |

**Responses** for **POST** `/kitchens`, **GET** `/kitchens`, **GET** `/kitchens/:id`, **PATCH** `/kitchens/:id`, and **PATCH** `/kitchens/me/auto-accept-orders` include the full kitchen row, including **`is_veg`**.

**Existing databases:** If you do not rely on TypeORM **`synchronize`**, run **`migrations/20260329120000_add_kitchen_is_veg.sql`** once to add **`is_veg`** to **`kitchens`**.

### Get Kitchen Credits

**GET** `/kitchens/credits`
**Role Required:** `KITCHEN_OWNER`

Retrieves the current available credit balance for the authenticated kitchen owner.

### Get All Kitchens

**GET** `/kitchens`

Retrieves a list of all active kitchens. Each kitchen includes **`is_veg`**.

### Get Kitchen by ID

**GET** `/kitchens/:id`

Retrieves details of a specific kitchen, including **`is_veg`**.

### Update Kitchen

**PATCH** `/kitchens/:id`
**Role Required:** `KITCHEN_OWNER`

Updates an existing kitchen profile.

**Request Body:**
Partial of **Create Kitchen** body.

### Set auto-accept orders (kitchen owner)

**PATCH** `/kitchens/me/auto-accept-orders`
**Role Required:** `KITCHEN_OWNER`

Sets **`auto_accept_orders`** for the authenticated owner’s kitchen (one kitchen per owner). Same effect as including `auto_accept_orders` in **PATCH** `/kitchens/:id` for that kitchen.

**Request body:**


| Field     | Type    | Required | Description                        |
| --------- | ------- | -------- | ---------------------------------- |
| `enabled` | boolean | **Yes**  | `true` to auto-accept new orders; `false` to require manual accept/reject. |

**Responses:** `200` with full kitchen object; `404` if the user has no kitchen.

**Behaviour:** When enabled, **`POST /orders`** and **`POST /payments/confirm`** create orders with status **`ACCEPTED`** and **`accepted_at`** set; the pending-order timeout job is not enqueued; the client receives the usual “order accepted” push. Existing **PENDING** orders are not changed.

---

## Kitchen payouts & withdrawals (`/api/kitchen`)

Kitchen owners save **bank / UPI details** for manual payouts and submit **withdrawal requests** by email to operations. There is **no** automatic balance deduction and **no** RazorpayX integration; credits stay on the owner’s account until support processes the payout.

**Server environment:** `MIN_KITCHEN_WITHDRAWAL_INR` (required for withdrawals) must be set to a **positive** number (rupees). Invalid or missing values cause **`500`** when a withdrawal is attempted. `BREVO_API_KEY` is required in production (`PRODUCTION` not `false`) so the notification email can be sent.

**Balance source:** Withdrawals are validated against the same **`users.credits`** balance as **GET** `/kitchens/credits` (the kitchen owner’s wallet).

### Get saved bank details

**GET** `/api/kitchen/bank-details`  
**Role Required:** `KITCHEN_OWNER`

Returns the row from **`kitchen_bank_details`** for the authenticated owner’s kitchen, or **`null`** if none exists.

**Success (`200`):** Full bank-details object (see **PATCH** body fields) including `id`, `kitchen_id`, `created_at`, `updated_at`, or `null`.

### Create or update bank details (upsert)

**PATCH** `/api/kitchen/bank-details`  
**Role Required:** `KITCHEN_OWNER`

Creates or updates the single bank-details record for the owner’s kitchen (unique on `kitchen_id`).

**Request Body:**


| Field                  | Type   | Required | Description                    |
| ---------------------- | ------ | -------- | ------------------------------ |
| `account_holder_name`  | string | **Yes**  | Name on the bank account.      |
| `account_number`       | string | **Yes**  | Bank account number.           |
| `ifsc_code`            | string | **Yes**  | IFSC code.                     |
| `bank_name`            | string | **Yes**  | Bank name.                     |
| `upi_id`               | string | No       | UPI ID; omit or empty to clear |

**Success (`200`):** Saved **`kitchen_bank_details`** entity.

**Errors:** `404` if the user has no kitchen.

### Request withdrawal (manual payout)

**POST** `/api/kitchen/withdraw`  
**Role Required:** `KITCHEN_OWNER`  
**Success:** **`200`** (not `201`)

**Request Body:**


| Field    | Type   | Required | Description                                      |
| -------- | ------ | -------- | ------------------------------------------------ |
| `amount` | number | **Yes**  | Amount in INR; must be ≥ `MIN_KITCHEN_WITHDRAWAL_INR` and ≤ owner `credits`. |
| `note`   | string | No       | Optional message included in the ops email.    |

**Success (`200`):**

```json
{
  "message": "Withdrawal request submitted. Our team will process the payout manually."
}
```

**Behaviour:** Sends a transactional email via **Brevo** to **`payouts@nutritiffin.com`** with subject **`Withdrawal Request – [Kitchen Name]`**, including kitchen name, owner name, registered email and phone, amount (INR), and saved bank details (including UPI if set). In development (`PRODUCTION=false`), the email is logged to the console instead.

**Errors:**

| Status | When |
| ------ | ---- |
| `400`  | Amount below minimum, no bank details saved, or **insufficient** `credits`. |
| `404`  | No kitchen for this account, or user record missing. |
| `500`  | `MIN_KITCHEN_WITHDRAWAL_INR` misconfigured, Brevo failure, or other server error submitting the request. |

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

Retrieves all menu items for a specific kitchen (only items with **`is_available: true`**).

**Query parameters:**


| Parameter        | Type   | Required | Description |
| ---------------- | ------ | -------- | ----------- |
| `scheduled_for`  | string | No       | Delivery date in **`YYYY-MM-DD`**. When set, each item in the response includes **`remaining_daily_orders`**: how many more portions can still be ordered for that date before hitting **`max_daily_orders`**. Must be the **same 1–3 days in advance** window as [Create Order](#create-order) (otherwise **`400`**). Omit this parameter if you do not need per-date capacity (response shape matches the historical payload without **`remaining_daily_orders`**). |

**Response fields (when `scheduled_for` is provided):**

In addition to the usual food item columns, each object includes:

| Field                     | Type   | Description |
| ------------------------- | ------ | ----------- |
| `remaining_daily_orders`  | number | Non-negative. **`max_daily_orders`** minus total quantity already ordered for this item on **`scheduled_for`**, counting all non-**`REJECTED`** orders. **`0`** if a **`food_item_availability`** row exists for that date with **`is_available: false`**. |

### Get Menu Item by ID

**GET** `/menu-items/:id`

Retrieves details of a specific menu item (only if **`is_available: true`**).

**Query parameters:** Same optional **`scheduled_for`** as [Get Menu Items by Kitchen](#get-menu-items-by-kitchen). When present, the single object includes **`remaining_daily_orders`** with the same meaning as above.

**Errors:**

| Status | When |
| ------ | ---- |
| `400`  | `scheduled_for` is not a valid date in the allowed advance window. |
| `404`  | Item missing or not publicly available. |

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

If the target kitchen has **`auto_accept_orders: true`**, the saved order is **`ACCEPTED`** immediately (see [Kitchens](#kitchens-kitchens)); otherwise it starts **`PENDING`** until the kitchen accepts or rejects (or the server auto-rejects after timeout).

**Request Body:**


| Field           | Type   | Required | Description                                                             |
| --------------- | ------ | -------- | ----------------------------------------------------------------------- |
| `kitchen_id`    | string | **Yes**  | ID of the kitchen to order from.                                        |
| `scheduled_for` | string | **Yes**  | Date for the order in `YYYY-MM-DD` format. Must be 1-3 days in advance. |
| `notes`         | string | No       | Optional instructions for the kitchen (customization, spice level, allergies, etc.). Max **2000** characters; leading/trailing whitespace trimmed; omit or send empty for none. |
| `items`         | array  | **Yes**  | List of items to order.                                                 |


**Item Object (in `items` array):**


| Field          | Type   | Required | Description                |
| -------------- | ------ | -------- | -------------------------- |
| `food_item_id` | string | **Yes**  | ID of the menu item.       |
| `quantity`     | number | **Yes**  | Quantity to order (min 1). |


### Order notes (`notes`)

- **Set by:** `CLIENT` only, at **order creation** (`POST /orders`, or the same fields inside `POST /payments/initiate` / `originalDto` on `POST /payments/confirm`).
- **Stored** on the `orders` row and returned on **`GET /orders`** and **`GET /orders/:id`** for **client**, **kitchen owner**, and **delivery driver** mapped views (`notes` is `string` or **`null`**).
- **Kitchen push:** When `notes` is non-empty, the new-order FCM payload includes **`hasNotes`: `"1"`** (otherwise **`"0"`**), and the notification body mentions that the customer left preparation notes.
- **Not editable** after create (no PATCH for notes); clients should treat checkout as the only chance to add or change text.

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

Retrieves all orders for the authenticated user (Client or Kitchen Owner) with role-specific details. For **clients**, each order’s **`kitchen`** includes **`is_veg`**, and each **line item** includes per-line rating state (see below). For **kitchen owners**, the same **`kitchen`** shape applies, and the payload also includes **`client`** and **`kitchen_fees`**; line items omit rating fields. Every mapped order includes **`notes`** (`string` or `null`) when present at creation.

### Rate or update rating for an order line (client)

**POST** `/orders/:orderId/items/:itemId/rating`
**Role Required:** `CLIENT`

**`:itemId`** is the **`order_item_id`** (the line on that order), not the catalog `food_item_id`.

Creates or updates a **1–5 star** integer rating for that line. The order must belong to the authenticated client and be **`DELIVERED`**. There is **no time limit** after delivery. Each **(client, order_item)** pair has at most one review row; resubmitting **updates** the stars.

**Request body (JSON):**


| Field    | Type   | Required | Description        |
| -------- | ------ | -------- | ------------------ |
| `stars`  | number | **Yes**  | Integer **1–5**.   |


**Response:** Saved review entity, including `stars`, `order_item_id`, `food_item_id`, `created_at`, `updated_at`.

### Get Order by ID

**GET** `/orders/:id`
**Role Required:** Authenticated User

Retrieves details of a specific order.

**Response (client — each item includes rating state):**

```json
{
  "id": "order-uuid",
  "status": "ACCEPTED",
  "scheduled_for": "2026-02-16",
  "notes": "Less oil; no dairy",
  "total_price": 250.0,
  "kitchen": {
    "id": "kitchen-id",
    "name": "Kitchen Name",
    "phone": "...",
    "address": "...",
    "is_veg": false
  },
  "items": [
    {
      "order_item_id": "order-line-uuid",
      "food_item_id": "item-id",
      "name": "Item Name",
      "image_url": "http://...",
      "quantity": 2,
      "snapshot_price": 100.0,
      "is_rated": true,
      "rating": { "stars": 4 }
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

When a **paid** order is **rejected** (kitchen reject or auto timeout on **PENDING** orders), the backend creates a **full Razorpay refund**, sets `refund_status` to `PENDING`, and fills `refund_expected_by` (7 business days after initiation, UTC). The client receives a push notification with refund messaging. Unpaid (legacy) orders get `refund_status` `NOT_APPLICABLE`. Orders created under **auto-accept** never enter **PENDING**, so they are not subject to that timeout reject.

**Client line items:** `is_rated` is **`false`** and **`rating`** is **`null`** until the client submits stars for that `order_item_id`. Kitchen-owner and driver mapped views keep the slimmer item shape (no `order_item_id` / `is_rated` / `rating`).

### Get delivery handoff OTP (in-app)

**GET** `/orders/:id/delivery-handoff-otp`
**Role Required:** `CLIENT`

Returns the **4-digit** handoff code the customer shows the delivery partner at the door. Only available while the order status is **`OUT_FOR_DELIVERY`** and only for the **order owner**.

**Response:**


| Field                   | Type   | Description                                                                 |
| ----------------------- | ------ | --------------------------------------------------------------------------- |
| `otp`                   | string | Four digits, zero-padded (e.g. `0427`).                                     |
| `expires_in_seconds`    | number | Remaining lifetime of the current code (Redis TTL), capped for display use. |

```json
{
  "otp": "0427",
  "expires_in_seconds": 13842
}
```

**Behaviour notes:**

- When the driver calls **`PATCH /deliveries/:id/out-for-delivery`**, the server issues a new code (or replaces any previous one) and stores it in **Redis** with a **4-hour** TTL.
- The same code is returned on repeat calls until it expires or the delivery is completed successfully.
- If Redis had no code but the order is still `OUT_FOR_DELIVERY` (e.g. rare cache loss), the server creates a new code.

**Errors:** `400` if the order is not `OUT_FOR_DELIVERY`; `403` if the client does not own the order.

### Get order tracking (live map / ETA)

**Implementation guide (client apps, credentials, polling, polylines):** **[`docs/Maps.md`](./Maps.md)**

**GET** `/orders/:id/tracking`
**Roles:** `CLIENT` (order owner), `DELIVERY_DRIVER` (assigned driver), or `ADMIN`.

Returns a **snapshot** for polling: last driver position (Redis), destination coordinates, and an optional **Google Routes** polyline with distance and ETA.

**Visibility**

| Role | When allowed |
| ---- | ------------ |
| `CLIENT` | Order status is **`PICKED_UP`** or **`OUT_FOR_DELIVERY`** (customer sees live tracking only after pickup). |
| `DELIVERY_DRIVER` | Assigned to the order and status is **`ACCEPTED`**, **`READY`**, **`PICKED_UP`**, or **`OUT_FOR_DELIVERY`**. |
| `ADMIN` | Same status window as driver (no ownership check). |

**Coordinates:** Pickup uses **`kitchens.latitude` / `kitchens.longitude`** (or geocoded `details.address`). Drop-off uses **`users.latitude` / `users.longitude`** on the client (or geocoded `address` + `pincode`). Set coordinates via kitchen create/update and **`PATCH /users/me`** (`latitude` / `longitude` optional fields). If the API cannot resolve a destination, `destination` is `null` and `route_error` explains why.

**Response (selected fields):**


| Field | Type | Description |
| ----- | ---- | ----------- |
| `order_id` | string | Order UUID. |
| `order_status` | string | Current `OrderStatus`. |
| `phase` | string | `TO_PICKUP` (driver → kitchen) or `TO_DROPOFF` (driver → customer). |
| `driver_position` | object \| null | `{ lat, lng, heading, recordedAt }` from the driver’s last **`PATCH /deliveries/:id/location`**. |
| `destination` | object \| null | `{ latitude, longitude, label }`. |
| `route` | object \| null | `{ encodedPolyline, distanceMeters, durationSeconds, eta }` (Google); cached ~55s server-side. |
| `route_error` | string \| null | e.g. missing API key, no driver position yet, geocoding failure. |

**Rate limits:** Throttled in production (see app throttler); clients should poll about every **5–10 seconds**.

**Example response (200):**

```json
{
  "order_id": "28ba8bab-8c42-4e7a-beac-c5843965b260",
  "order_status": "OUT_FOR_DELIVERY",
  "phase": "TO_DROPOFF",
  "driver_position": {
    "lat": 19.074,
    "lng": 72.875,
    "heading": 180,
    "recordedAt": "2026-03-27T12:00:05.000Z"
  },
  "destination": {
    "latitude": 19.08,
    "longitude": 72.88,
    "label": "123 MG Road, Mumbai"
  },
  "route": {
    "encodedPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    "distanceMeters": 2400,
    "durationSeconds": 420,
    "eta": "2026-03-27T12:07:00.000Z"
  },
  "route_error": null
}
```

`driver_position`, `destination`, or `route` may be `null` depending on whether the driver has reported location, coordinates/geocoding succeeded, and whether routing ran successfully. See **`route_error`** when `route` is null.

**Errors:** `400` if the order is not in an allowed status for that role; `403` if the caller cannot access the order; `404` if the order does not exist.

### Accept Order

**PATCH** `/orders/:id/accept`
**Role Required:** `KITCHEN_OWNER`

Marks an order as `ACCEPTED` (only when the current status is **`PENDING`**). Orders that were auto-accepted at creation are already **`ACCEPTED`**; this endpoint is not required for them.

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

**Request Body:** Same as **Create Order** (`kitchen_id`, `scheduled_for`, `items[]`, optional `notes`).

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
| `originalDto`       | object | **Yes**  | Same body as **Create Order** (must match what was used for initiate), including optional **`notes`** if the client entered preparation instructions. |


**Response:** Created `Order` entity (same as **Create Order**), with `paymentStatus: PAID` and Razorpay ids set.

If the kitchen has **`auto_accept_orders: true`**, the order may already have **`status: ACCEPTED`** and **`accepted_at`** set (same as **Create Order**).

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

Public. Returns maintenance state for splash screens, read-only banners, etc. Redis keys: `nutri:maintenance_until` (end instant, ms), optional `nutri:maintenance_from` (start instant, ms), and `nutri:maintenance_open_ended` when there is no fixed duration.

The response has **three independent fields**:

| Field                     | Type             | Description                                                                                                                                                                                                 |
| ------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_under_maintainance`   | boolean          | `true` only while the current time is inside the window: after the stored start (if any) and before the stored end. `false` before a future `starts_at`, after the window ends, or when maintenance is off. |
| `maintenance_starts_at`   | string \| `null` | ISO 8601 (UTC) when the window **starts**, if the backend stored a start time. `null` for older Redis data that only had an end time, or when maintenance is off.                                            |
| `maintenance_ends_at`     | string \| `null` | ISO 8601 (UTC) when the window **ends**, only when a **fixed length** was set (`hours` / `time` > 0 on **POST**). `null` when off, **open-ended** (no duration), or legacy indefinite-only storage.         |

**Query parameters (optional):**

| Field   | Type   | Required | Description                                                                                                                                                                                                 |
| ------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hours` | number | No       | If **> 0**, `is_under_maintainance` is `true` only when the window is active **and** a fixed end exists with **at least** that many hours remaining. Ignored for open-ended windows (no fixed end in Redis). |
| `time`  | number | No       | Same as `hours`; use one or the other; `hours` wins if both are sent.                                                                                                                                       |

**Default when Redis has no maintenance keys:** `is_under_maintainance` is `false` (normal operation) until an admin turns maintenance on via **POST**.

**Response (example when off):**

```json
{
  "is_under_maintainance": false,
  "maintenance_starts_at": null,
  "maintenance_ends_at": null
}
```

**Response (example when on with a fixed end, e.g. 2 hours from a defined start):**

```json
{
  "is_under_maintainance": true,
  "maintenance_starts_at": "2026-04-03T16:00:00.000Z",
  "maintenance_ends_at": "2026-04-03T18:00:00.000Z"
}
```

**Response (example when scheduled but not started yet):** `is_under_maintainance` is `false` until `maintenance_starts_at`, while the start/end instants are still returned so clients can show a countdown.

---

**POST** `/is_under_maintainance`

**Role required:** `ADMIN` (JWT `Authorization: Bearer …`).

Sets maintenance mode in Redis (clears all related keys when turning off).

**Content-Type:** `application/json`

**Request body:**

| Field                   | Type    | Required | Description                                                                                                                                                                                                 |
| ----------------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_under_maintainance` | boolean | **Yes**  | `false` → maintenance **off**. `true` → maintenance **on** (see `starts_at` and duration below).                                                                                                            |
| `starts_at`             | string  | No       | When `true`: ISO 8601 datetime for when the window **starts** (use a `Z` suffix or offset for UTC). Omit → **now**. Can be in the future to schedule maintenance.                                           |
| `hours`                 | number  | No       | When `true`: if **> 0**, maintenance lasts that many hours **from `starts_at`** (or from now if `starts_at` is omitted). Omit or `0` → **open-ended** after start: `maintenance_ends_at` in responses is `null`. |
| `time`                  | number  | No       | Same as `hours`; `hours` wins if both are sent.                                                                                                                                                             |

**Examples**

Turn maintenance off:

```json
{ "is_under_maintainance": false }
```

Maintenance **from** a UTC instant **for** 2 hours:

```json
{
  "is_under_maintainance": true,
  "starts_at": "2026-04-03T16:00:00.000Z",
  "hours": 2
}
```

Maintenance **from** 4pm UTC with **no** fixed duration (open-ended after that start):

```json
{
  "is_under_maintainance": true,
  "starts_at": "2026-04-03T16:00:00.000Z"
}
```

Immediate maintenance for 3 hours (no `starts_at`):

```json
{ "is_under_maintainance": true, "hours": 3 }
```

Immediate open-ended maintenance:

```json
{ "is_under_maintainance": true }
```

**Response:** Same shape as **GET** (three fields above), reflecting state **after** the update.

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

Delivery completion uses an **in-app handoff code**: the **client** reads **`GET /orders/:id/delivery-handoff-otp`** (4 digits) and tells the driver; the driver submits that code in **`PATCH /deliveries/:id/finish`**. Codes live in **Redis** (see **Get delivery handoff OTP** under [Orders](#orders-orders)).

Payments are **prepaid**; drivers do not accrue a cash-collection balance. Kitchen owners still receive their **kitchen payout** on successful finish (see **Finish Delivery** below).

### Get Available Deliveries

**GET** `/deliveries/available`
**Role Required:** `DELIVERY_DRIVER`

Retrieves a list of orders that are `ACCEPTED` or `READY` for pickup. Each order’s **`kitchen`** includes **`id`**, **`name`**, **`is_veg`**, and **`details`** (address, phone).

### Get My Deliveries

**GET** `/deliveries/my-orders`
**Role Required:** `DELIVERY_DRIVER`

Retrieves a list of orders assigned to the authenticated driver. Each order’s **`kitchen`** relation includes the full kitchen columns (including **`is_veg`**).

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

**Side effect:** Issues a new **4-digit** handoff code in Redis for this order (4-hour TTL) so the customer can retrieve it via **`GET /orders/:id/delivery-handoff-otp`**. If Redis cannot store the code, the request fails and the status is not updated.

### Update driver GPS location

**Driver app integration (intervals, errors, map keys):** **[`docs/Maps.md`](./Maps.md)**

**PATCH** `/deliveries/:id/location`
**Role Required:** `DELIVERY_DRIVER`

Stores the driver’s latest position in **Redis** for **`GET /orders/:id/tracking`**. Allowed only for the **assigned** driver while status is **`READY`**, **`PICKED_UP`**, or **`OUT_FOR_DELIVERY`**.

**Request body (JSON):**


| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `lat` | number | **Yes** | WGS84 latitude (−90…90). |
| `lng` | number | **Yes** | WGS84 longitude (−180…180). |
| `heading` | number | No | Bearing in degrees, if available from the device. |

**Response:** `{ "ok": true, "recordedAt": "<ISO8601>" }`

**Side effect (optional):** When status is **`OUT_FOR_DELIVERY`**, if the driver is within **~500 m** (straight-line) of the customer drop-off and a one-shot Redis flag is not set, the customer receives a **Driver is nearby** FCM (requires Firebase + client FCM token).

**Rate limits:** Enforced even in development (`@ForceThrottle`): **30 requests / minute** per default throttler scope.

### Finish Delivery

**PATCH** `/deliveries/:id/finish`
**Role Required:** `DELIVERY_DRIVER`

Completes delivery only after the **correct handoff code** from the customer’s app. Updates status to `DELIVERED`, credits the **kitchen owner** (payout transaction), and **consumes** the code (single use). The delivery driver is **not** credited (no COD wallet).

**Request body (JSON):**


| Field | Type   | Required | Description                                      |
| ----- | ------ | -------- | ------------------------------------------------ |
| `otp` | string | **Yes**  | **4-digit** code from **`GET /orders/:id/delivery-handoff-otp`**. |

```json
{
  "otp": "0427"
}
```

**Errors:**

- `400` — wrong or missing code, expired/missing code, invalid format (must be exactly 4 digits).
- `429` — too many incorrect attempts for this order; customer should confirm the code shown in the app.

On success, the customer receives the usual **Order Delivered** push notification.

### Get Order Details

**GET** `/deliveries/:id`
**Role Required:** `DELIVERY_DRIVER` or `ADMIN`

Retrieves full order details. Depending on the user's role, the shape of the response differs.

**Response for Delivery Driver:**

Uses the same order view as **`GET /orders/:id`** for drivers: nested **`kitchen`** includes **`id`**, **`name`**, **`phone`**, **`address`**, and **`is_veg`** (veg / non-veg tag). The payload includes **`notes`** (`string` \| `null`) when the customer left kitchen instructions at checkout.

```json
{
  "id": "order-uuid",
  "status": "OUT_FOR_DELIVERY",
  "scheduled_for": "2026-03-06",
  "notes": null,
  "total_price": 250.00,
  "kitchen": {
    "id": "kitchen-id",
    "name": "Kitchen Name",
    "phone": "...",
    "address": "...",
    "is_veg": false
  },
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
  "kitchen": { "name": "Main Kitchen", "is_veg": false },
  "status": "IN_TRANSIT",
  "items": ["Paneer Tiffin x1", "Extra Roti x2"],
  "driver": "Ravi",
  "destination": "Andheri West, Mumbai",
  "estimated_delivery": "2026-03-06",
  "notes": "Extra roti; mild spice",
  "created_at": "2026-03-06T11:30:00Z"
}
```

---

## Restaurants (`/restaurants`)

**Restaurant** IDs in this API are the same as **kitchen** IDs (`kitchens.id`). There is **no** stored aggregate rating on the kitchen row: averages are computed from **`reviews.stars`** joined to **`food_items`** for that kitchen.

### Restaurant stats (public)

**GET** `/restaurants/:id/stats`

Returns aggregated metrics for the kitchen/restaurant. **No auth.** Rate limited like other public stats (**20/min**).

**Response:**

```json
{
  "total_orders": 42,
  "total_customers": 18,
  "average_rating": 4.25,
  "weighted_average_rating": 4.22,
  "total_ratings": 120,
  "rating_distribution": { "1": 2, "2": 4, "3": 15, "4": 40, "5": 59 },
  "top_items": [
    {
      "name": "Paneer bowl",
      "average_rating": 4.8,
      "total_ratings": 12
    }
  ]
}
```


| Field                  | Type   | Description |
| ---------------------- | ------ | ----------- |
| `total_orders`         | number | Count of **`DELIVERED`** orders for this kitchen. |
| `total_customers`      | number | Distinct clients among those delivered orders. |
| `average_rating`       | number \| null | Plain arithmetic mean of **`reviews.stars`** for this kitchen (**two decimals**); **`null`** if no ratings. |
| `weighted_average_rating` | number \| null | **Use for sorting / “best kitchen” lists.** Bayesian blend: \((v/(v+m))·R + (m/(v+m))·C\) where \(R\) = `average_rating`, \(v\) = `total_ratings`, \(C\) = platform-wide mean of all item ratings (or fallback **3.5** if none), \(m\) = **`RATING_BAYESIAN_MIN_REVIEWS`** (default **10**). Few ratings pull toward \(C\); many ratings stay close to \(R\). **`null`** if this kitchen has no ratings. |
| `total_ratings`        | number | Count of review rows contributing to item ratings for this kitchen. |
| `rating_distribution`  | object | Counts of ratings by star value **`"1"`…`"5"`**. |
| `top_items`            | array  | Up to **5** menu items with **≥ 3** ratings, ordered by average stars (desc). |

---

## Reviews (`/reviews`)

Star ratings (**1–5**) are stored per **`order_item`** (see **`POST /orders/:orderId/items/:itemId/rating`**). Listing endpoints return each review’s **`stars`** (and related ids/timestamps) unless noted otherwise.

**Cross-reference:** Narrative flow and examples — **`docs/ratings.md`**. Client journey — **`docs/role-client.md`** § Reviews & ratings.

### Get My Reviews

**GET** `/reviews/my`
**Role Required:** `CLIENT`

Returns a **JSON array** of reviews for the authenticated client, with the **`food_item`** relation loaded.

### Get Reviews by Food Item

**GET** `/reviews/food-item/:foodItemId`

Returns reviews for the food item plus order volume: **`total_orders`** (distinct orders containing the item, excluding rejected orders) and **`total_quantity_ordered`** (sum of line quantities).

**Response:**

```json
{
  "reviews": [
    {
      "id": "review-uuid",
      "client_id": "client-uuid",
      "kitchen_id": "kitchen-uuid",
      "food_item_id": "food-item-uuid",
      "order_id": "order-uuid",
      "order_item_id": "order-item-uuid",
      "stars": 5,
      "created_at": "2026-03-15T12:00:00.000Z",
      "updated_at": "2026-03-15T12:00:00.000Z"
    }
  ],
  "total_orders": 128,
  "total_quantity_ordered": 142
}
```

### Get Reviews by Kitchen

**GET** `/reviews/kitchen/:kitchenId`

Returns a **JSON array** of reviews for that kitchen, **`created_at`** descending (newest first).

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

