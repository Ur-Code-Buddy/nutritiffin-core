# Live delivery maps and tracking

This guide explains how **customer** and **delivery driver** apps integrate with the NutriTiffin API for **live position**, **ETA**, **route polyline**, and related push notifications.

Canonical field-level API detail: **[`api-reference.md`](./api-reference.md)** (Orders → **Get order tracking**, Deliveries → **Update driver GPS location**).

---

## 1. How the backend fits together

| Layer | Responsibility |
| ----- | ---------------- |
| **Driver app** | Reads GPS (foreground / background as allowed by OS), sends periodic **`PATCH /deliveries/:orderId/location`**. |
| **API (NestJS)** | Validates JWT + role, stores last position in **Redis** (`delivery:loc:{orderId}`). Calls **Google Routes API** for driving distance, duration, and **encoded polyline**; caches route ~55s per order. |
| **Customer app** | Polls **`GET /orders/:orderId/tracking`** every **5–10 seconds** while the order is trackable; draws marker + optional route on a map SDK. |
| **Google Cloud** | **Routes API** and **Geocoding API** are used **only from the server** with `GOOGLE_MAPS_API_KEY`. |

There is **no WebSocket** in this stack yet: updates are **poll-based**. That keeps mobile integration simple and matches the current API.

---

## 2. Credentials and keys

### 2.1 Backend (you configure on the server only)

| Variable | Purpose |
| -------- | -------- |
| **`GOOGLE_MAPS_API_KEY`** | Server calls to **Routes API** (`computeRoutes`) and **Geocoding API** (fallback when lat/lng are missing). |

**Google Cloud Console (same project as the key):**

1. Enable **Routes API** (and **Geocoding API** if you rely on address fallback).
2. Attach a billing account.
3. Restrict this key for **server use** (e.g. **IP addresses** of your API host). **Do not** embed this key in mobile or web client bundles.

See also [`.env.example`](../.env.example) and [`docker-compose.yml`](../docker-compose.yml).

### 2.2 Mobile / web clients (separate from the backend key)

To **display** maps and decode polylines you still need platform-appropriate keys (these are **not** `GOOGLE_MAPS_API_KEY` on the server):

| Platform | Typical setup |
| -------- | ------------- |
| **Android** | Maps SDK for Android API key in the app; restrict by package name + SHA-1. |
| **iOS** | Maps SDK for iOS key restricted by bundle ID (or use Apple MapKit for display only and still use backend-provided polyline/coords). |
| **Web** | Maps JavaScript API key with HTTP referrer restrictions. |

The **tracking JSON** from the API is enough to plot the route if your SDK can render an **encoded polyline** (Google’s format).

### 2.3 Auth for API calls

All tracking endpoints require:

```http
Authorization: Bearer <JWT>
```

- Driver: role **`DELIVERY_DRIVER`** for **`PATCH /deliveries/:id/location`**.
- Customer: role **`CLIENT`** for **`GET /orders/:id/tracking`** (must own the order).

### 2.4 Push notifications (optional but recommended)

- **FCM** device token via **`PATCH /users/me/fcm-token`** (see [`notifications.md`](../notifications.md)).
- Backend sends **“picked up”**, **“out for delivery”**, **“delivered”**, and a **one-shot “Driver is nearby”** when the driver is within **~500 m** straight-line of the drop-off while status is **`OUT_FOR_DELIVERY`** (requires Firebase service account file on the server, as today).

---

## 3. Prerequisites: coordinates

Routing needs **latitude/longitude**. The API uses, in order:

| Destination | Source |
| ----------- | ------ |
| **Pickup** (`phase`: `TO_PICKUP`) | **`kitchens.latitude` / `kitchens.longitude`**, else geocoded **`kitchen.details.address`**. |
| **Drop-off** (`phase`: `TO_DROPOFF`) | **`users.latitude` / `users.longitude`** (the **client**), else geocoded **`address` + `pincode`**. |

**Recommended product flow**

1. **Kitchen owner app** — set pickup pin when creating/updating the kitchen (**`POST /kitchens`**, **`PATCH /kitchens/:id`** with `latitude`, `longitude`). Use Places Autocomplete or a map picker.
2. **Customer app** — set delivery pin on the profile (**`PATCH /users/me`** with `latitude`, `longitude` alongside `current_password`). Keep them in sync when the user changes address.

If coordinates are missing, the server may still geocode text; ambiguous addresses can yield **`destination`: `null`** or **`route_error`** in the tracking response.

---

## 4. Order status vs who sees what

| `order_status` | `phase` | Customer `GET …/tracking` | Driver `GET …/tracking` | Driver `PATCH …/location` |
| -------------- | ------- | ------------------------- | ------------------------ | --------------------------- |
| `ACCEPTED` | `TO_PICKUP` | Not allowed | Allowed (assigned) | Not allowed |
| `READY` | `TO_PICKUP` | Not allowed | Allowed | **Allowed** |
| `PICKED_UP` | `TO_DROPOFF` | **Allowed** | Allowed | **Allowed** |
| `OUT_FOR_DELIVERY` | `TO_DROPOFF` | **Allowed** | Allowed | **Allowed** |
| Other | — | Not allowed | Not allowed | Not allowed |

**Meaning of `phase`**

- **`TO_PICKUP`** — destination on the snapshot is the **kitchen**; route is from last driver position → kitchen.
- **`TO_DROPOFF`** — destination is the **customer delivery** point; route is from last driver position → customer.

---

## 5. Endpoints

### 5.1 Driver — report GPS

**`PATCH /deliveries/:orderId/location`**

**Body (JSON):**

```json
{
  "lat": 19.076,
  "lng": 72.8777,
  "heading": 90
}
```

| Field | Required | Notes |
| ----- | -------- | ----- |
| `lat` | Yes | WGS84, −90…90 |
| `lng` | Yes | WGS84, −180…180 |
| `heading` | No | Degrees, if the OS provides it |

**Success (200):**

```json
{
  "ok": true,
  "recordedAt": "2026-03-27T12:00:00.000Z"
}
```

**Throttling:** **30 requests / minute** (enforced even when `PRODUCTION=false` via `@ForceThrottle`). Aim for **one update every 2–5 seconds** while on an active leg, and backoff when stationary.

**Errors:** `400` wrong status or body; `403` not the assigned driver; `404` unknown order.

---

### 5.2 Customer / driver / admin — tracking snapshot

**`GET /orders/:orderId/tracking`**

**Roles:** `CLIENT` (owner only), `DELIVERY_DRIVER` (assigned), or `ADMIN`.

**Success (200)** — example shape:

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

| Field | Meaning |
| ----- | ------- |
| `driver_position` | Last driver fix; **`null`** until the first successful `PATCH …/location`. |
| `destination` | **`null`** if pickup/drop-off coordinates could not be resolved. |
| `route` | **`null`** if routing failed or was skipped; see `route_error`. |
| `route_error` | Human-readable reason, e.g. missing API key, no driver position yet, geocoding failure. |

**Throttling:** **60 requests / minute** (with `@ForceThrottle`). Poll **every 5–10 s** in the UI.

**Errors:** `400` status not allowed for this role; `403` not allowed to view this order; `404` order missing.

---

## 6. Implementing the customer app

1. After order is **`PICKED_UP`** or **`OUT_FOR_DELIVERY`**, show a **“Track delivery”** screen.
2. Start a **timer** or **repeat** `GET /orders/:id/tracking` every **5–10 s**; stop on **`DELIVERED`** or when the user leaves the screen.
3. If `driver_position` is non-null, move a **marker** (`lat`, `lng`); use `heading` to rotate an icon if you want.
4. If `route.encodedPolyline` is present, **decode** it with your map SDK and draw a **polyline** (Google Maps Android/iOS have built-in helpers; on web use the Maps JavaScript `GeometryEncoding` library or a small decoder package).
5. Show **ETA** from `route.eta` (ISO string) or compute from `durationSeconds`.
6. Show **distance** from `route.distanceMeters` (format as km/mi in the UI).
7. If `route` is null but `route_error` is set, show a fallback (“Location updating…” / “Route unavailable”) while still showing the marker if you have `driver_position`.
8. Listen for **FCM** payloads (e.g. `type: driver_nearby`) to show an in-app banner in addition to the system notification.

---

## 7. Implementing the driver app

1. When the driver has an active order in **`READY`**, **`PICKED_UP`**, or **`OUT_FOR_DELIVERY`**, subscribe to **location updates** (respect iOS/Android **background** limits and disclosure strings).
2. On each fix (or throttled to respect **30 req/min**), call **`PATCH /deliveries/:orderId/location`** with `lat`, `lng`, and optional `heading`.
3. For **turn-by-turn navigation**, open the system map or Google Maps with the **destination** from your own UI (kitchen address vs customer address from **`GET /deliveries/:id`** or **`GET /orders/:id`**), or use **`GET /orders/:id/tracking`** as driver to read `destination` + `route` for a map preview inside your app.
4. **Optimized multi-stop routes** (multiple orders at once) are **not** implemented in this API; the backend computes **one leg** (driver → current `phase` destination) per order.

---

## 8. Polyline encoding

The API returns Google’s **encoded polyline** (see [Encoded Polyline Algorithm](https://developers.google.com/maps/documentation/utilities/polylinealgorithm)). Use your platform’s SDK to decode:

- **Android:** `com.google.maps.android:android-maps-utils` — `PolyUtil.decode(encoded)`.
- **iOS:** Google Maps SDK utilities or a small Swift decoder.
- **Web:** `@googlemaps/polyline-codec` or the Maps JavaScript `google.maps.geometry.encoding.decodePath`.

---

## 9. Troubleshooting

| Symptom | Things to check |
| ------- | ---------------- |
| `route_error` mentions API key | `GOOGLE_MAPS_API_KEY` set on server; Routes + Geocoding enabled; billing; IP restrictions include your server. |
| `destination` is null | Set **kitchen** and **user** `latitude`/`longitude`; improve address strings for geocoding. |
| `driver_position` always null | Driver must call **`PATCH …/location`**; check JWT role and assignment; order status must be **READY** / **PICKED_UP** / **OUT_FOR_DELIVERY**. |
| Customer gets 400 on tracking | Customer only allowed for **`PICKED_UP`** and **`OUT_FOR_DELIVERY`**. |
| 429 on location | Reduce ping frequency; limit is **30/min** per throttler scope. |

---

## 10. Source code pointers (backend)

| Area | Path |
| ---- | ---- |
| Tracking logic | `src/delivery-tracking/delivery-tracking.service.ts` |
| Google Routes | `src/delivery-tracking/google-routes.service.ts` |
| Geocoding fallback | `src/delivery-tracking/google-geocoding.service.ts` |
| Driver route | `src/deliveries/deliveries.controller.ts` → `PATCH :id/location` |
| Customer route | `src/orders/orders.controller.ts` → `GET :id/tracking` |
