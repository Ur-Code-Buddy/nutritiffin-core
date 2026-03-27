# NutriTiffin Delivery System API Documentation

Production Base URL:
`https://backend.v1.nutritiffin.com`

All IDs are UUID strings.  
All protected endpoints require:
`Authorization: Bearer <JWT>`

Role required for delivery endpoints: `DELIVERY_DRIVER`

---

## The Delivery Workflow

As a Delivery Partner, the standard lifecycle on an order flows like this:

1. **Find an Order:** Driver checks the available deliveries array via `GET /deliveries/available`.
2. **Accept:** Driver binds to an order via `PATCH /deliveries/:id/accept`. Order stays at `ACCEPTED` or `READY`.
3. **Pick Up:** Driver arrives at the Kitchen, sees the order is `READY`. Driver triggers `PATCH /deliveries/:id/pick-up`. Status becomes `PICKED_UP`. 
4. **Out for Delivery:** Driver begins driving to the client via `PATCH /deliveries/:id/out-for-delivery`. Status becomes `OUT_FOR_DELIVERY`. The backend stores a **4-digit** handoff code in Redis for the customer’s app.
5. **Finish Delivery:** At the door, the **customer** shows the **4-digit** code from **`GET /orders/:id/delivery-handoff-otp`** in their app. The driver submits it in the body of **`PATCH /deliveries/:id/finish`** as `{ "otp": "1234" }`. Status becomes `DELIVERED`, and the driver is credited (`GET /deliveries/credits`).

---

## Endpoints

### 1. Get Driver Credits

**GET** `/deliveries/credits`
**Role Required:** `DELIVERY_DRIVER`

Retrieves the current available credit account balance built from delivery efforts natively.

**Success Response (200 OK):**
```json
{
  "credits": 250.00
}
```

---

### 2. Get Available Deliveries

**GET** `/deliveries/available`
**Role Required:** `DELIVERY_DRIVER`

Retrieves an interactive list of unassigned orders that are marked either `ACCEPTED` (kitchen accepted the task but isn't done preparing) or `READY` (kitchen finished preparing, available for physical pick-up immediately).

**Success Response (200 OK):**
```json
[
  {
    "id": "28ba8bab-8c42-4e7a-beac-c5843965b260",
    "status": "READY",
    "total_price": "280.00",
    "created_at": "2026-03-03T17:34:25.105Z",
    "scheduled_for": "2026-03-04",
    "kitchen": {
      "id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
      "name": "Arjuns Kitchen",
      "details": {
        "address": "123 MG Road",
        "phone": "9876543210"
      }
    }
  }
]
```

---

### 3. Get My Deliveries

**GET** `/deliveries/my-orders`
**Role Required:** `DELIVERY_DRIVER`

Retrieves a detailed list of all orders exclusively assigned to the authenticated driver logic.

**Success Response (200 OK):**
```json
[
  {
    "id": "28ba8bab-8c42-4e7a-beac-c5843965b260",
    "status": "OUT_FOR_DELIVERY",
    "scheduled_for": "2026-03-04",
    "total_price": "280.00",
    "kitchen": {
      "id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
      "name": "Arjuns Kitchen"
    },
    "client": {
      "id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
      "name": "Rahul Sharma"
    }
  }
]
```

---

### 4. Accept Delivery

**PATCH** `/deliveries/:id/accept`
**Role Required:** `DELIVERY_DRIVER`

Assigns the selected available order to the specific driver account permanently. Requires the order to be `ACCEPTED` or `READY`. Fails if it's already assigned.

**Success Response (200 OK):**
```json
{
  "id": "28ba8bab-8c42-4e7a-beac-c5843965b260",
  "status": "READY",
  "delivery_driver_id": "driver-uuid-123",
  "updated_at": "2026-03-03T17:40:20.105Z"
}
```

---

### 5. Pick Up Delivery

**PATCH** `/deliveries/:id/pick-up`
**Role Required:** `DELIVERY_DRIVER`

Registers that the driver has arrived at the given kitchen and retrieved the items successfully. Only operates when the order is formally marked `READY` by the parent kitchen. Updates status to `PICKED_UP`.

**Success Response (200 OK):**
```json
{
  "id": "28ba8bab-8c42-4e7a-beac-c5843965b260",
  "status": "PICKED_UP",
  "picked_up_at": "2026-03-03T17:45:00.000Z"
}
```

---

### 6. Out For Delivery

**PATCH** `/deliveries/:id/out-for-delivery`
**Role Required:** `DELIVERY_DRIVER`

Transitions the state representing transit logic towards the client drop-off location. Order status enters `OUT_FOR_DELIVERY` state natively. A new **4-digit** handoff code is issued for the customer (see client **`GET /orders/:id/delivery-handoff-otp`**).

**Success Response (200 OK):**
```json
{
  "id": "28ba8bab-8c42-4e7a-beac-c5843965b260",
  "status": "OUT_FOR_DELIVERY"
}
```

---

### 7. Finish Delivery

**PATCH** `/deliveries/:id/finish`
**Role Required:** `DELIVERY_DRIVER`

**Request body (JSON):** `{ "otp": "<4-digit code>" }` — the code the customer reads from **`GET /orders/:id/delivery-handoff-otp`** in the client app.

Permanently resolves the task, records `delivered_at` timing natively tracking to metrics, and releases credits accurately. Order updates to `DELIVERED`. Wrong or missing `otp` returns `400`; too many failed attempts returns `429`.

**Success Response (200 OK):**
```json
{
  "id": "28ba8bab-8c42-4e7a-beac-c5843965b260",
  "status": "DELIVERED",
  "delivered_at": "2026-03-03T18:10:00.000Z"
}
```

---

### 8. Get Delivery Summary / Order Details

**GET** `/deliveries/:id`
**Role Required:** `DELIVERY_DRIVER`

Used when the driver opens up the specific delivery card to navigate routes natively viewing full granular addresses.

**Success Response (200 OK):**
```json
{
  "id": "28ba8bab-8c42-4e7a-beac-c5843965b260",
  "status": "PICKED_UP",
  "total_price": "280.00",
  "kitchen": {
      "id": "c282d569-e3a9-4820-ad35-d4093a8b96d8",
      "name": "Arjuns Kitchen",
      "phone": "9876543210",
      "address": "123 MG Road"
  },
  "client": {
      "id": "8f6fdea3-5971-4030-aa92-5d5448d981d0",
      "name": "Rahul Sharma",
      "phone_number": "+918887776666",
      "address": "Target Delivery Street, Block A"
  },
  "items": [
      {
          "food_item_id": "aebf865c-abf8-405b-9e5b-ab4fce869084",
          "name": "Virtual Tiffin",
          "quantity": 1,
          "snapshot_price": "100.00"
      }
  ]
}
```
