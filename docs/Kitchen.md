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

| Field            | Type      | Description |
|------------------|----------|-------------|
| id               | UUID     | Unique kitchen identifier |
| owner_id         | UUID     | User ID of the kitchen owner |
| name             | string   | Kitchen name |
| details          | JSON     | Address, phone, description |
| operating_hours  | JSON     | Weekly schedule configuration |
| image_url        | string   | Kitchen cover image URL |
| is_active        | boolean  | Whether kitchen is active |
| is_menu_visible  | boolean  | Whether menu is visible to clients |
| availability_days| string[] | Days the menu is available |
| created_at       | datetime | Creation timestamp |
| updated_at       | datetime | Last update timestamp |

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

| Field            | Required | Description |
|------------------|----------|-------------|
| name             | Yes      | Name of the kitchen |
| details          | No       | Additional kitchen details |
| operating_hours  | No       | Weekly schedule. Times must be in **HH:MM** format (e.g. 09:00). |
| image_url        | No       | Public image URL |
| is_active        | No       | Defaults to true |
| is_menu_visible  | No       | Defaults to true |
| availability_days| No       | List of available days |

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
- is_active
- is_menu_visible

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

# 5. Get Kitchen Credits

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

# Business Rules

1. Only users with role KITCHEN_OWNER can create kitchens.
2. Kitchen owners can only update their own kitchens.
3. Clients can view only active kitchens.
4. Inactive kitchens may be hidden from public listing.
5. Each kitchen is linked to exactly one owner.
6. All IDs are UUID format.

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

All endpoints have been tested and verified.
