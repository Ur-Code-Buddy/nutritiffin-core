# Delivery API Documentation

## Base URLs

- **Production**: `https://backend.v1.nutritiffin.com`
- **Local**: `http://localhost:3000`

---

## Authentication

All endpoints require a specific **Header**:
`Authorization: Bearer <JWT_TOKEN>`

**User Role Required**: `DELIVERY_DRIVER`

---

## Data Enums

### Order Status

The `status` field in responses can be one of:

- `PENDING`: Created by client, not yet accepted by kitchen.
- `ACCEPTED`: Accepted by kitchen, waiting for driver (Visible in Available).
- `REJECTED`: Rejected by kitchen.
- `PICKED_UP`: Picked up by driver from the kitchen.
- `OUT_FOR_DELIVERY`: On the way to the client.
- `DELIVERED`: Successfully delivered.
- `CANCELLED`: Cancelled by user.

---

## Endpoints

### 1. Get Driver Credits

Retrieves the current available credit balance for the authenticated delivery driver.

- **URL**: `/deliveries/credits`
- **Method**: `GET`
- **Description**: Use this to show the driver their current earnings/credits.

**Success Response (200 OK):**

```json
{
  "credits": 250
}
```

---

### 2. Get Available Deliveries

Retrieves a list of orders that are ready for pickup. These orders have been accepted by the kitchen but have no driver assigned yet.

- **URL**: `/deliveries/available`
- **Method**: `GET`
- **Description**: Use this to show the "Job Board" or "Available Orders" list to the driver.
- **Notes**:
  - **Client details (address/phone) are HIDDEN** in this view to protect privacy until the order is accepted.
  - Returns orders sorted by creation date (Oldest first).

**Success Response (200 OK):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ACCEPTED",
    "scheduled_for": "2026-02-16",
    "total_price": 450.0,
    "kitchen": {
      "id": "kitchen-uuid-123",
      "name": "Spicy Treats Kitchen",
      "phone": "9876543210",
      "address": "123 Culinary Ave, Food City"
    },
    "items": [
      {
        "food_item_id": "item-uuid-001",
        "name": "Chicken Biryani",
        "image_url": "https://s3.aws.com/...",
        "quantity": 2,
        "snapshot_price": 225.0
      }
    ]
    // Note: 'client' and 'delivery_driver' fields are null/undefined here
  }
]
```

---

### 2. Get My Active Deliveries

Retrieves all orders where the current user is assigned as the driver.

- **URL**: `/deliveries/my-orders`
- **Method**: `GET`
- **Description**: Use this to show the "My Tasks" or "Current Deliveries" list.
- **Notes**:
  - **Client details ARE INCLUDED** here (Name, Phone, Address) so the driver knows where to deliver.

**Success Response (200 OK):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "OUT_FOR_DELIVERY",
    "scheduled_for": "2026-02-16",
    "total_price": 450.0,
    "kitchen": {
      "id": "kitchen-uuid-123",
      "name": "Spicy Treats Kitchen",
      "phone": "9876543210",
      "address": "123 Culinary Ave, Food City"
    },
    "client": {
      "id": "client-uuid-456",
      "name": "Rahul Sharma",
      "phone_number": "9988776655",
      "address": "Flat 402, Sunshine Apts, Metro City"
    },
    "items": [
      {
        "food_item_id": "item-uuid-001",
        "name": "Chicken Biryani",
        "quantity": 2,
        "snapshot_price": 225.0
      }
    ]
  }
]
```

---

### 3. Get Order Details

Retrieves full details for a specific order.

- **URL**: `/deliveries/:id`
- **Method**: `GET`
- **Path Param**: `id` (UUID of the order)
- **Description**: View single order details.

**Success Response (200 OK):**
_Same structure as "My Active Deliveries"_

---

### 4. Accept Delivery

Assigns the current driver to the order. The status remains `ACCEPTED`.

- **URL**: `/deliveries/:id/accept`
- **Method**: `PATCH`
- **Path Param**: `id` (UUID of the order)
- **Description**: Call this when the driver swipes "Accept".

**Success Response (200 OK):**
Returns the updated Order object (including client details now).

**Error Responses:**

- `400 Bad Request`: If order is not in `ACCEPTED` state (e.g. already taken by someone else).
- `404 Not Found`: If order ID is invalid.

---

### 5. Pick Up Delivery

Marks the order as `PICKED_UP`.

- **URL**: `/deliveries/:id/pick-up`
- **Method**: `PATCH`
- **Path Param**: `id` (UUID of the order)
- **Description**: Call this when the driver arrives at the kitchen and picks up the order.

**Success Response (200 OK):**
Returns the updated Order object with status `PICKED_UP`.

**Error Responses:**

- `400 Bad Request`: If order is not `ACCEPTED` or assigned to a different driver.

---

### 6. Out For Delivery

Marks the order as `OUT_FOR_DELIVERY`.

- **URL**: `/deliveries/:id/out-for-delivery`
- **Method**: `PATCH`
- **Path Param**: `id` (UUID of the order)
- **Description**: Call this when the driver leaves the kitchen towards the client.

**Success Response (200 OK):**
Returns the updated Order object with status `OUT_FOR_DELIVERY`.

**Error Responses:**

- `400 Bad Request`: If order is not `PICKED_UP` or assigned to a different driver.

---

### 7. Finish Delivery

Marks the order as `DELIVERED`.

- **URL**: `/deliveries/:id/finish`
- **Method**: `PATCH`
- **Path Param**: `id` (UUID of the order)
- **Description**: Call this when the driver swipes "Complete Delivery".

**Success Response (200 OK):**
Returns the updated Order object with status `DELIVERED`.

**Error Responses:**

- `400 Bad Request`: If order is not `OUT_FOR_DELIVERY` or assigned to a different driver.
