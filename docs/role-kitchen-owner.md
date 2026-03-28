# Kitchens API Documentation

## Base URL

Production:
https://backend.v1.nutritiffin.com

Local Development:
http://localhost:3000

---

## Authentication

Protected routes require:

Authorization: Bearer <JWT_TOKEN>

Only users with role `KITCHEN_OWNER` can create or update kitchens.

---

# Kitchens Module Overview

The Kitchens module allows:

- Kitchen owners to create and manage their kitchen
- Clients to view active kitchens
- Public users to browse available kitchens

Each kitchen belongs to exactly one owner.

---

# Data Model

| Field             | Type     | Description                        |
| ----------------- | -------- | ---------------------------------- |
| id                | UUID     | Unique kitchen identifier          |
| owner_id          | UUID     | User ID of the kitchen owner       |
| name              | string   | Kitchen name                       |
| details           | JSON     | Address, phone, description        |
| operating_hours   | JSON     | Weekly schedule configuration      |
| image_url         | string   | Kitchen cover image URL            |
| is_active         | boolean  | Whether kitchen is active          |
| is_menu_visible   | boolean  | Whether menu is visible to clients |
| auto_accept_orders | boolean | When `true`, new orders are created as **ACCEPTED** (no manual accept/reject). Default `false`. |
| is_veg            | boolean  | Defaults to false (non-veg). If true, it is vegetarian |
| positive_count    | number   | Number of thumbs up / positive reviews |
| negative_count    | number   | Number of thumbs down / negative reviews |
| availability_days | string[] | Days the menu is available         |
| created_at        | datetime | Creation timestamp                 |
| updated_at        | datetime | Last update timestamp              |

---

# 1. Create Kitchen

Endpoint:
POST /kitchens

Role Required:
KITCHEN_OWNER

Headers:
Authorization: Bearer <JWT_TOKEN>

---

## Request Body

```json
{
  "name": "Rahul's Home Kitchen",
  "details": {
    "address": "221B Baker Street, Mumbai",
    "phone": "23872393834",
    "description": "Healthy home cooked meals delivered fresh."
  },
  "operating_hours": {
    "monday": { "open": "09:00", "close": "21:00" },
    "tuesday": { "open": "09:00", "close": "21:00" },
    "wednesday": { "open": "09:00", "close": "21:00" },
    "thursday": { "open": "09:00", "close": "21:00" },
    "friday": { "open": "09:00", "close": "22:00" },
    "saturday": { "open": "10:00", "close": "22:00" },
    "sunday": { "open": "10:00", "close": "20:00" }
  },
  "image_url": "https://example.com/kitchen.jpg",
  "is_active": true,
  "is_menu_visible": true,
  "availability_days": ["monday", "wednesday", "friday"]
}
```

---

## Field Details

| Field             | Required | Description                                                      |
| ----------------- | -------- | ---------------------------------------------------------------- |
| name              | Yes      | Name of the kitchen                                              |
| details           | No       | Additional kitchen details                                       |
| operating_hours   | No       | Weekly schedule. Times must be in **HH:MM** format (e.g. 09:00). |
| image_url         | No       | Public image URL                                                 |
| is_active         | No       | Defaults to true                                                 |
| is_menu_visible   | No       | Defaults to true                                                 |
| auto_accept_orders | No      | Defaults to `false`. If `true`, new orders skip **PENDING** (see §5). |
| availability_days | No       | List of available days                                           |

---

## Success Response (201 Created)

```json
{
  "id": "814cec7e-dd52-4ced-a46f-58cbff911e02",
  "owner_id": "1cd704d9-ded3-44f4-a918-6df45112127c",
  "name": "Rahul's Home Kitchen",
  "details": {
    "address": "221B Baker Street, Mumbai",
    "phone": "23872393834",
    "description": "Healthy home cooked meals delivered fresh."
  },
  "operating_hours": { ... },
  "image_url": "https://example.com/kitchen.jpg",
  "is_active": true,
  "is_menu_visible": true,
  "created_at": "2026-02-15T05:15:32.979Z",
  "updated_at": "2026-02-15T05:15:32.979Z"
}
```

---

## Error Responses

401 Unauthorized  
403 Forbidden  
400 Bad Request

---

# 2. Get All Kitchens

Endpoint:
GET /kitchens

Public endpoint.

Returns all active kitchens.

---

## Success Response (200 OK)

```json
[
  {
    "id": "814cec7e-dd52-4ced-a46f-58cbff911e02",
    "name": "Rahul's Home Kitchen",
    "details": {
      "address": "221B Baker Street, Mumbai",
      "phone": "23872393834",
      "description": "Healthy home cooked meals delivered fresh."
    },
    "image_url": "https://example.com/kitchen.jpg",
    "is_active": true,
    "is_menu_visible": true,
    "created_at": "2026-02-15T05:15:32.979Z",
    "updated_at": "2026-02-15T05:15:32.979Z"
  }
]
```

---

# 3. Get Kitchen By ID

Endpoint:
GET /kitchens/:id

Public endpoint.

Example:
GET /kitchens/814cec7e-dd52-4ced-a46f-58cbff911e02

---

## Success Response (200 OK)

```json
{
  "id": "814cec7e-dd52-4ced-a46f-58cbff911e02",
  "owner_id": "1cd704d9-ded3-44f4-a918-6df45112127c",
  "name": "Rahul's Home Kitchen",
  "details": {
    "address": "221B Baker Street, Mumbai",
    "phone": "23872393834",
    "description": "Healthy home cooked meals delivered fresh."
  },
  "operating_hours": { ... },
  "image_url": "https://example.com/kitchen.jpg",
  "is_active": true,
  "is_menu_visible": true,
  "created_at": "2026-02-15T05:15:32.979Z",
  "updated_at": "2026-02-15T05:15:32.979Z"
}
```

---

## Error Response

404 Not Found

---

# 4. Update Kitchen

Endpoint:
PATCH /kitchens/:id

Role Required:
KITCHEN_OWNER

Headers:
Authorization: Bearer <JWT_TOKEN>

Only the owner of the kitchen can update it.

---

## Request Body (Partial Allowed)

```json
{
  "name": "Updated Kitchen Name",
  "is_menu_visible": false
}
```

Updatable fields:

- name
- details
- operating_hours
- image_url
- latitude, longitude (pickup pin)
- is_active
- is_menu_visible
- auto_accept_orders

---

## Success Response (200 OK)

```json
{
  "id": "814cec7e-dd52-4ced-a46f-58cbff911e02",
  "name": "Updated Kitchen Name",
  "is_menu_visible": false,
  "updated_at": "2026-02-15T06:10:00.000Z"
}
```

---

## Error Responses

401 Unauthorized  
403 Forbidden  
404 Not Found  
400 Bad Request

---

# 5. Auto-accept new orders (toggle)

Endpoint:
PATCH /kitchens/me/auto-accept-orders

Role Required:
KITCHEN_OWNER

Headers:
Authorization: Bearer <JWT_TOKEN>

Turns **automatic acceptance** on or off for **your** kitchen (the one linked to the authenticated owner). You do not pass a kitchen id in the URL; the server resolves it from the JWT.

When **enabled**, every **new** order placed against your kitchen (via `POST /orders` or the Razorpay `POST /payments/confirm` path) is stored as **`ACCEPTED`** immediately, with **`accepted_at`** set. The kitchen does **not** need to call `PATCH /orders/:id/accept`. The **10-minute auto-reject** timeout job is **not** scheduled for those orders. The customer receives the same **“order accepted”** push as after a manual accept.

When **disabled**, behaviour matches the default: new orders start as **`PENDING`**, the timeout job applies, and the kitchen must accept or reject.

You can also set `auto_accept_orders` via **PATCH /kitchens/:id** on your own kitchen (partial body).

---

## Request Body

```json
{
  "enabled": true
}
```

| Field    | Type    | Required | Description                          |
| -------- | ------- | -------- | ------------------------------------ |
| enabled  | boolean | **Yes**  | `true` to auto-accept; `false` off. |

---

## Success Response (200 OK)

Returns the full kitchen object (same shape as **Get Kitchen By ID**), including `auto_accept_orders`.

---

## Error Responses

401 Unauthorized  
403 Forbidden  
404 Not Found — no kitchen exists for this account.  
400 Bad Request — invalid body (e.g. missing `enabled`).

---

# 6. Get Kitchen Credits

Endpoint:
GET /kitchens/credits

Role Required:
KITCHEN_OWNER

Headers:
Authorization: Bearer <JWT_TOKEN>

Returns the current credit balance of the authenticated kitchen owner.

---

## Success Response (200 OK)

```json
{
  "credits": 500
}
```

---

# 7. Transaction History

Endpoint:
GET /transactions/my

Role Required:
KITCHEN_OWNER

Headers:
Authorization: Bearer <JWT_TOKEN>

Returns a paginated history of all credit transactions the kitchen owner was part of. This includes:
- **SUPPORT** transactions: When admins add or deduct credits.
- **DELIVERY** transactions: When the kitchen receives a payout for a completed delivery. The description mentions the delivery short ID (e.g. "Kitchen payout for delivery DEL-X9K2").

---

## Query Parameters

| Field | Required | Description |
| ----- | -------- | ----------- |
| page  | No       | Page number (default: 1) |
| limit | No       | Items per page (default: 20, max: 100) |

---

## Success Response (200 OK)

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
        "id": "owner-uuid",
        "name": "Kitchen Owner",
        "username": "owner01",
        "role": "KITCHEN_OWNER"
      },
      "created_at": "2026-03-02T17:25:00.000Z"
    },
    {
      "id": "txn-uuid-2",
      "short_id": "TXN-G7H8I9",
      "type": "CREDIT",
      "source": "DELIVERY",
      "amount": 230,
      "description": "Kitchen payout for delivery DEL-X9K2",
      "reference_id": "order-uuid",
      "from": null,
      "to": {
        "id": "owner-uuid",
        "name": "Kitchen Owner",
        "username": "owner01",
        "role": "KITCHEN_OWNER"
      },
      "created_at": "2026-03-02T18:00:00.000Z"
    }
  ],
  "total": 2,
  "page": 1,
  "limit": 20
}
```

---

## Get Single Transaction

GET /transactions/:id

Returns a single transaction. Kitchen owners can only view transactions they are part of.

Error Responses:
- 403 Forbidden: Transaction doesn't involve you.
- 404 Not Found: Invalid transaction ID.

---

# Business Rules

1. Only users with role KITCHEN_OWNER can create kitchens.
2. Kitchen owners can only update their own kitchens.
3. Clients can view only active kitchens.
4. Inactive kitchens may be hidden from public listing.
5. Each kitchen is linked to exactly one owner.
6. **Auto-accept** affects only **new** orders created after the flag is on; existing **PENDING** orders are unchanged.
7. All IDs are UUID format.

---

# Security Notes

- JWT authentication enforced for protected routes.
- Owner authorization validation enforced on update.
- Sensitive user data is never exposed.
- Password hashes are never returned in responses.
- All timestamps use ISO 8601 format.

---

# Testing Checklist

- Create kitchen with valid owner token
- Attempt create with CLIENT role
- Attempt create without token
- Fetch all kitchens
- Fetch kitchen by ID
- Update kitchen as owner
- Attempt update as non owner
- Attempt update without token
- Toggle auto-accept: PATCH /kitchens/me/auto-accept-orders with `{ "enabled": true }` then place a test order and confirm status is ACCEPTED without calling accept

All endpoints have been tested and verified.
