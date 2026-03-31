# Ratings API

Star ratings are **per order line** (`order_item`): each `(client, order_item)` has at most one review row, which can be **created or updated** (upsert). Kitchen-level aggregates are computed from `reviews` joined to `food_items`; nothing is stored on the `kitchens` row for averages.

There is **no** `POST /reviews` endpoint. Clients submit stars via **`POST /orders/.../rating`**.

Unless noted, paths are relative to the API root (no global prefix in `main.ts`).

---

## 1. Submit or update a rating (client)

| | |
| --- | --- |
| **Method / path** | `POST /orders/:orderId/items/:itemId/rating` |
| **Auth** | `Authorization: Bearer <JWT>`, role **`CLIENT`** |
| **Body** | `{ "stars": <integer> }` where **stars** is **1–5** |
| **`:itemId`** | **`order_item_id`** for that order (the line id from order payloads), **not** the catalog `food_item_id` |

**Rules (server):** Order must belong to the client; line must belong to that order; order status must be **`DELIVERED`**. No time limit after delivery. Same line again **updates** the existing review.

**Response:** The persisted **`Review`** row (TypeORM), typically including:

`id`, `client_id`, `kitchen_id`, `food_item_id`, `order_id`, `order_item_id`, `stars`, `created_at`, `updated_at`

Nested relations (e.g. `food_item`) are **not** loaded on this response unless the implementation changes.

---

## 2. Orders: per-line rating state (client only)

For **`CLIENT`**, list and detail responses include rating state on each line. **`KITCHEN_OWNER`** and **`DELIVERY_DRIVER`** mapped views omit `order_item_id`, `is_rated`, and `rating`.

### `GET /orders`

| | |
| --- | --- |
| **Auth** | JWT |

**Response:** Array of client order views. Each element’s **`items[]`** entry includes:

| Field | Type | Description |
| --- | --- | --- |
| `order_item_id` | string | UUID of the order line |
| `food_item_id` | string | Menu item id |
| `name` | string | Snapshot name from menu |
| `image_url` | string | |
| `quantity` | number | |
| `snapshot_price` | number | |
| `is_rated` | boolean | `true` if this client has a review for this line |
| `rating` | object \| null | `null` or `{ "stars": number }` (1–5) |

### `GET /orders/:id`

| | |
| --- | --- |
| **Auth** | JWT; client may only access their own orders |

**Response:** Single client order view with the same **`items[]`** shape as above.

---

## 3. Review listings

### `GET /reviews/my`

| | |
| --- | --- |
| **Auth** | JWT, role **`CLIENT`** |

**Response:** Array of **`Review`** entities for the authenticated client, with **`food_item`** relation loaded.

### `GET /reviews/food-item/:foodItemId`

| | |
| --- | --- |
| **Auth** | None (public) |

**Response:** Array of **`Review`** rows for that food item, **`created_at` descending**.

### `GET /reviews/kitchen/:kitchenId`

| | |
| --- | --- |
| **Auth** | None (public) |

**Response:** Array of **`Review`** rows for that kitchen, **`created_at` descending**.

Each review includes **`stars`** plus foreign keys and timestamps as stored on `reviews`.

---

## 4. Restaurant / kitchen stats (aggregates)

**Restaurant id** in this API is the same as **kitchen id** (`kitchens.id`).

### `GET /restaurants/:id/stats`

| | |
| --- | --- |
| **Auth** | None (public; rate-limited like other public stats) |

**Response (JSON):**

| Field | Type | Description |
| --- | --- | --- |
| `total_orders` | number | Count of **`DELIVERED`** orders for this kitchen |
| `total_customers` | number | Distinct `client_id` on those orders |
| `average_rating` | number \| null | Arithmetic mean of `reviews.stars` for items in this kitchen (2 decimals); **`null`** if no ratings |
| `weighted_average_rating` | number \| null | Bayesian-style score for **ranking** kitchens (accounts for volume); **`null`** if no ratings |
| `total_ratings` | number | Count of reviews included in kitchen-level averages |
| `rating_distribution` | object | Counts keyed **`"1"` … `"5"`** |
| `top_items` | array | Up to **5** items with **≥ 3** ratings: `{ "name", "average_rating", "total_ratings" }`, by average stars desc |

See **`docs/api-reference.md`** (Restaurants) and **`.env.example`** (`RATING_BAYESIAN_*`) for weighted-score tuning.

---

## Related code

- `src/orders/orders.controller.ts` — `POST .../rating`, client order mapping
- `src/reviews/reviews.controller.ts` — `GET /reviews/*`
- `src/kitchens/restaurants.controller.ts` — `GET /restaurants/:id/stats`
- `src/reviews/reviews.service.ts` — upsert, listings, stars map for orders
- `src/kitchens/restaurant-stats.service.ts` — aggregate queries and weighted average
