# NutriTiffin Client API Documentation

Production Base URL:
https://backend.v1.nutritiffin.com

All IDs are UUID strings.
All prices are stored as decimal in database and returned as string.
All protected endpoints require:
Authorization: Bearer <JWT>

Role required for order endpoints: CLIENT

---

1. AUTHENTICATION

---

1.1 Register Client

POST /auth/register
Content-Type: application/json

Request Body:
{
"username": "client_user01",
"name": "Rahul Sharma",
"email": "rahul.sharma01@example.com",
"phone_number": "+919876543210",
"address": "123 MG Road, Pondicherry, Puducherry, India",
"password": "client123",
"role": "CLIENT"
}

Success Response (201):
{
"id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
"username": "client_user01",
"name": "Rahul Sharma",
"phone_number": "+919876543210",
"address": "123 MG Road, Pondicherry, Puducherry, India",
"role": "CLIENT",
"created_at": "2026-02-15T06:10:16.854Z",
"updated_at": "2026-02-15T06:10:16.854Z"
}

Validation Rules:

- username required, unique
- email required, valid format, unique (but not returned in response)
- phone_number required, unique
- password minimum 6 characters
- role must be `CLIENT` (Note: `ADMIN` registration requires the `admin_access_pass` field)

---

1.2 Login

POST /auth/login
Content-Type: application/json

Request Body:
{
"username": "client_user01",
"password": "client123"
}

Success Response:
{
"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
"user": {
"id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
"username": "client_user01",
"role": "CLIENT"
}
}

---

1.3 Get My Profile

GET /users/me

Returns the authenticated user's profile and current credit balance.

Success Response:
{
"id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
"username": "client_user01",
"name": "Rahul Sharma",
"email": "rahul.sharma01@example.com",
"phone_number": "+919876543210",
"address": "123 MG Road, Pondicherry, Puducherry, India",
"role": "CLIENT",
"credits": 50,
"is_active": true,
"created_at": "2026-02-15T06:10:16.854Z",
"updated_at": "2026-02-15T06:10:16.854Z"
}

---

2. KITCHENS

---

2.1 Get All Active Kitchens

GET /kitchens

Returns only:

- is_active = true
- is_menu_visible = true

Success Response:
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
"created_at": "2026-02-15T06:11:11.126Z",
"updated_at": "2026-02-15T06:31:08.132Z"
}
]

---

3. MENU ITEMS

---

3.1 Get Menu Items by Kitchen

GET /menu-items/kitchen/:kitchenId

Example:
GET /menu-items/kitchen/c282d569-e3a9-4820-ad35-d4093a8b96d8

Success Response:
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

Business Rules:

- Only return items where is_available = true
- Kitchen must be active
- Kitchen menu must be visible

---

4. ORDERS

---

All order endpoints require:
Authorization: Bearer <CLIENT_JWT>

4.1 Create Order

POST /orders
Content-Type: application/json

Request Body:
{
"kitchen_id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
"scheduled_for": "2026-02-16",
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

Business Rules:

- scheduled_for must be exactly tomorrow
- items array cannot be empty
- quantity minimum 1
- all items must belong to same kitchen
- backend calculates snapshot_price
- backend calculates total_price
- order status starts as PENDING

Success Response:
{
"id": "d0b9fa9b-66c2-4c9b-9647-91c0019fdc1f",
"client_id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
"kitchen_id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
"status": "PENDING",
"scheduled_for": "2026-02-16",
"total_price": 250.00,
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

---

4.2 Get My Orders

GET /orders

Returns all orders created by authenticated client.

Success Response:
[
{
"id": "d0b9fa9b-66c2-4c9b-9647-91c0019fdc1f",
"status": "ACCEPTED",
"scheduled_for": "2026-02-16",
"total_price": 250.00,
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
"address": "123"
},
"delivery_driver": null
}
]

---

4.3 Get Order By ID

GET /orders/:id

Example:
GET /orders/d0b9fa9b-66c2-4c9b-9647-91c0019fdc1f

Business Rules:

- Client can only access their own orders
- 404 if not found
- 403 if not owner

Success Response:
{
"id": "d0b9fa9b-66c2-4c9b-9647-91c0019fdc1f",
"status": "ACCEPTED",
"scheduled_for": "2026-02-16",
"total_price": 250.00,
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
"address": "123"
},
"delivery_driver": {
"id": "driver-uuid-123",
"name": "Driver Name",
"phone_number": "9876543210"
}
}

---

## ORDER STATUS VALUES

Possible status values:

- PENDING
- ACCEPTED
- REJECTED
- OUT_FOR_DELIVERY
- DELIVERED

---

## ERROR RESPONSE FORMAT

Example Standard Error:

{
"statusCode": 400,
"message": "Order must be scheduled for tomorrow",
"error": "Bad Request"
}
