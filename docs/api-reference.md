# API Endpoints Documentation

## Base URL

All endpoints are relative to the base URL: `http://localhost:3000` (for local development).

---

## Authentication (`/auth`)

### Register User

**POST** `/auth/register`

Creates a new user account.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `username` | string | **Yes** | Unique username. |
| `name` | string | **Yes** | Full name of the user. |
| `email` | string | **Yes** | Email address (unique). |
| `phone_number` | string | **Yes** | Phone number (unique). |
| `address` | string | **Yes** | Physical address of the user. |
| `pincode` | string | **Yes** | PIN Code/Postal code. |
| `password` | string | **Yes** | Password (min 6 characters). |
| `role` | enum | **Yes** | User role. Values: `CLIENT`, `KITCHEN_OWNER`, `DELIVERY_DRIVER`, `ADMIN`. |
| `admin_access_pass` | string | No | Required only if `role` is `ADMIN`. |

**Response:** Returns a success message prompting the user to verify their email. A verification email is sent (placeholder for now).

### Login

**POST** `/auth/login`

Authenticates a user and returns a JWT token. **Rejects users who have not verified their email.**

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `username` | string | **Yes** | Registered username. |
| `password` | string | **Yes** | User password. |

### Verify Email

**GET** `/auth/verify-email?token=...`

Verifies a user's email address using the token sent during registration.

**Query Parameters:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `token` | string | **Yes** | The verification token from the email. |

**Behavior:**

- Looks up the user by the token.
- Returns a 302 Redirect to the frontend application:
  - On success: Redirects to `FRONTEND_URL/verification-success` (and sets `is_verified: true`, clears token).
  - On invalid token: Redirects to `FRONTEND_URL/verification-failed?reason=invalid`.
  - On expired token (tokens are valid for 24 hours): Redirects to `FRONTEND_URL/verification-failed?reason=expired`.

### Resend Verification Email

**POST** `/auth/resend-verification`

Regenerates a verification token and resends the verification email.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | string | **Yes** | The email address associated with the account. |

**Behavior:**

- Returns `404` if no account is found with the provided email.
- Returns `400` if the email is already verified.
- Generates a new token (valid for 24 hours) and sends a verification email.

### Retry Email Login

**POST** `/auth/retry-email-login`

Retries sending the verification email for login. This functions identically to the resend verification endpoint.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | string | **Yes** | The email address associated with the account. |

**Behavior:**

- Returns `404` if no account is found with the provided email.
- Returns `400` if the email is already verified.
- Generates a new token (valid for 24 hours) and sends a verification email.
- Has a rate limit: max 1 request every 30 seconds.

### Check if Email Verified

**POST** `/auth/check-email-verified`

Checks whether the provided email is verified. Has a rate limit: max 1 request every 10 seconds.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | string | **Yes** | The email address to check. |

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
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | string | **Yes** | The email address associated with the account. |

**Response:** Returns a generic success message to prevent user enumeration.

### Reset Password

**POST** `/auth/reset-password`

Completes the password reset process by verifying the emailed OTP against Redis and saving the new password hash. Immediately bumps the token version, forcing re-authentication everywhere.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | string | **Yes** | The user's email address. |
| `otp` | string | **Yes** | The 6-digit OTP from the email. |
| `new_password` | string | **Yes** | The new password (min 6 characters). |

**Response:** Returns a success message.

### Request Phone OTP (Resend / Registration)

**POST** `/auth/resend-phone-otp`

Integrates with the **MessageCentral CPaaS API** to send a 6-digit SMS OTP to a phone number. Temporary storage via Redis.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `phone` | string | **Yes** | Target phone number. |

**Response:**
```json
{
  "message": "OTP sent successfully"
}
```

### Verify Phone OTP

**POST** `/auth/verify-phone`
**Role Required:** Authenticated User

Validates an SMS OTP against the MessageCentral API using the provided OTP and phone number. Successfully verifying will automatically mark the associated NutriTiffin user account as `phone_verified = true` and update their phone number. Returns 409 if phone belongs to another verified account.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `phone` | string | **Yes** | The phone number being verified. |
| `otp` | string | **Yes** | The code entered by the user. |

**Response:**
```json
{
  "message": "Phone number verified successfully",
  "verified": true
}
```

---

## Users & Administration (`/users` & `/admin`)

### Get Current User Profile

**GET** `/users/me`
**Role Required:** Authenticated User

Retrieves the profile of the currently logged-in user, including their Rupee `credits` balance.

### Get All Users

**GET** `/admin/users`
**Role Required:** `ADMIN`

Retrieves a list of all registered users and their credit balances.

### Add User Credits

**POST** `/admin/credits/add`
**Role Required:** `ADMIN`

Adds integer credits (Rupees) to a specific user's account. **A transaction record is automatically created.**

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `username` | string | **Yes** | Username of the user. |
| `credits` | number | **Yes** | Integer amount of Rupees to add. |

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
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | **Yes** | Name of the kitchen. |
| `details` | object | No | Additional details (address, phone, description). |
| `operating_hours` | object | No | Operating hours configuration (Times in **HH:MM**). |
| `image_url` | string | No | URL to the kitchen's cover image. |
| `is_active` | boolean | No | Whether the kitchen is active (default: true). |
| `is_menu_visible` | boolean | No | Whether the menu is visible to users (default: true). |

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
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | **Yes** | Name of the dish. |
| `price` | number | **Yes** | Price of the dish. |
| `description` | string | No | Description of the dish. |
| `image_url` | string | No | URL to the dish image. |
| `max_daily_orders` | number | No | Maximum number of orders allowed per day. |
| `availability_days` | array | No | List of days the item is available (e.g. `["monday", "friday"]`). |

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
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `is_available` | boolean | **Yes** | `true` if available, `false` otherwise. |

---

## Orders (`/orders`)

### Create Order

**POST** `/orders`
**Role Required:** `CLIENT`

Places a new order.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `kitchen_id` | string | **Yes** | ID of the kitchen to order from. |
| `scheduled_for` | string | **Yes** | Date for the order in `YYYY-MM-DD` format. Must be 1-3 days in advance. |
| `items` | array | **Yes** | List of items to order. |

**Item Object (in `items` array):**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `food_item_id` | string | **Yes** | ID of the menu item. |
| `quantity` | number | **Yes** | Quantity to order (min 1). |

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
  }
}
```

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

Marks an order as `REJECTED`.

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
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `pass` | string | **Yes** | Super admin access password matching the `SUPER_ADMIN_ACCESS_PASS` environment variable. |

**Response:**
Returns a success message with the command execution output.

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
**Role Required:** `DELIVERY_DRIVER`

Retrieves full order details including addresses and phone numbers.

**Response:**

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


---

## Reviews (`/reviews`)

Clients can add reviews for individual `order_items` that belong to an order that has been `DELIVERED` within the last 24 hours. A review is marked as either a thumbs up (`positive_count`) or thumbs down (`negative_count`).

### Add a Review

**POST** `/reviews`
**Role Required:** `CLIENT`

Creates a review for a specific ordered item.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `order_item_id` | string | **Yes** | ID of the specific order item being reviewed. |
| `is_positive` | boolean | **Yes** | `true` for positive (upvote), `false` for negative (downvote). |

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
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | number | No | Page number (default: 1). |
| `limit` | number | No | Items per page (default: 20, max: 100). |

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

---

### Transaction Data Enums

#### Transaction Type

| Value | Description |
| :--- | :--- |
| `CREDIT` | Credits were added to a user |
| `DEBIT` | Credits were deducted from a user |

#### Transaction Source

| Value | Description |
| :--- | :--- |
| `SUPPORT` | Admin manually added/deducted credits. Shown as "SUPPORT" in `from`/`to` fields. |
| `DELIVERY` | Payment related to a delivery (kitchen/driver payout). Description mentions the delivery short ID. |
| `ORDER` | Payment related to order placement or refund. |

### Transaction `from` / `to` Fields

- When a real user is involved, the field contains: `{ id, name, username, role }`
- When the system (admin/support) is involved and no user is set, the field shows: `{ "label": "SUPPORT" }`
- Otherwise: `null`
