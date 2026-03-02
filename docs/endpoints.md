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
| `password` | string | **Yes** | Password (min 6 characters). |
| `role` | enum | **Yes** | User role. Values: `CLIENT`, `KITCHEN_OWNER`, `DELIVERY_DRIVER`, `ADMIN`. |
| `admin_access_pass` | string | No | Required only if `role` is `ADMIN`. |

### Login
**POST** `/auth/login`

Authenticates a user and returns a JWT token.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `username` | string | **Yes** | Registered username. |
| `password` | string | **Yes** | User password. |

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

Adds integer credits (Rupees) to a specific user's account.
**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `userId` | string | **Yes** | UUID of the user. |
| `amount` | number | **Yes** | Integer amount of Rupees to add. |

### Deduct User Credits
**POST** `/admin/credits/deduct`
**Role Required:** `ADMIN`

Deducts integer credits (Rupees) from a specific user's account. Fails if user has insufficient credits.
**Request Body:** Same as Add User Credits.

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
  "total_price": 250.00,
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
      "snapshot_price": 100.00
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

---

## Deliveries (`/deliveries`)

### Get Driver Credits
**GET** `/deliveries/credits`
**Role Required:** `DELIVERY_DRIVER`

Retrieves the current available credit balance for the authenticated delivery driver.

### Get Available Deliveries
**GET** `/deliveries/available`
**Role Required:** `DELIVERY_DRIVER`

Retrieves a list of orders that are `ACCEPTED` and ready for pickup.

### Get My Deliveries
**GET** `/deliveries/my-orders`
**Role Required:** `DELIVERY_DRIVER`

Retrieves a list of orders assigned to the authenticated driver.

### Accept Delivery
**PATCH** `/deliveries/:id/accept`
**Role Required:** `DELIVERY_DRIVER`

Assigns the order to the driver and updates status to `OUT_FOR_DELIVERY`.

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
