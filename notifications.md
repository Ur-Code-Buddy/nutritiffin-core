# Notification System Guide

This document describes the flow, architecture, and expectations for the **NutriTiffin Firebase Push Notifications System**.

## 1. Flow Overview

1. **Frontend App Initialized**: A Kitchen Owner or Delivery Driver opens their frontend application.
2. **Permission Request**: The app asks for "Notification Permissions" via the OS/Browser.
3. **Token Generation**: Upon acceptance, Firebase issues a unique **FCM Token** (Firebase Cloud Messaging Token) to that specific device.
4. **Token Storage**: The frontend pushes this token to the backend server via `PATCH /users/me/fcm-token`. The backend saves it to the `fcm_token` column on the `User` entity.
5. **Event Trigger**: When an important event happens (e.g., someone places a new order), the Backend looks up the target user's `fcm_token` and uses `firebase-admin` to securely fire a payload toward that device.
6. **Frontend Reception**:
   - **App in Background:** The OS natively displays the banner on the user's notification bar.
   - **App in Foreground:** The Firebase JS SDK picks up the payload in realtime (`onMessage()`), allowing the frontend UI to display a custom Toast/Alert.

---

## 2. Server-side API

### Updating the Token
Whenever a user logs in, or whenever their device token refreshes, the frontend must ensure the backend is aware of the current active token.

**Request**
- **Method**: `PATCH`
- **URL**: `/users/me/fcm-token`
- **Headers**: `Authorization: Bearer <JWT Token>`
- **Body**: 
```json
{
  "fcm_token": "fXwN4r2D...Your-Long-Token-String"
}
```

**Response**
- `200 OK`
```json
{
  "success": true,
  "message": "FCM token updated successfully"
}
```

---

## 3. Currently Configured Triggers

The system is currently configured to send out following notifications:

### A. New Order Received
Sent to the **Kitchen Owner** whenever a new valid order is placed.

**Payload Received by Frontend:**
```json
{
  "notification": {
    "title": "New Order Received!",
    "body": "A new order was placed. Please check your dashboard."
  },
  "data": {
    "orderId": "b3f5c78a-12d4-49ab-8c9e-11aa234cf789"
  }
}
```
*Note: The `data` packet contains the `orderId` so that your frontend app can immediately route the user to that specific order page when they tap on the push notification!*

*(To add more triggers like "Order Ready", "Driver Assigned", etc., simply call `NotificationsService.sendPushNotification()` from anywhere inside the NestJS app.)*

---

## 4. Frontend Expectations & Requirements

### 4.1 Required Firebase Setup
Your frontend must have the exact `firebaseConfig` object corresponding to the project where you downloaded the `nutritiffinServiceAccountKey.json`.

```javascript
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const app = initializeApp({ /* Your Firebase Config */ });
const messaging = getMessaging(app);
```

### 4.2 Handling Foreground Notifications
If the user currently has your website/app open on their screen, the OS **WILL NOT** automatically show a native push banner. Instead, Firebase drops the payload locally so you can alert them inside your UI (e.g. using `react-toastify` or `Snackbar`).

```javascript
// Add this inside your root component (like App.js)
import { onMessage } from "firebase/messaging";

onMessage(messaging, (payload) => {
  console.log("Foreground message received:", payload);
  
  // Example UI feedback:
  // toast.info(`${payload.notification.title} - ${payload.notification.body}`);
});
```

### 4.3 Handling Background Notifications
If the app is closed or backgrounded, Firebase takes over natively:
- **Mobile Apps (React Native/Flutter):** Handled via native OS hooks.
- **Web Applications:** Requires a Service Worker exactly named **`firebase-messaging-sw.js`** inside your `public` directory.

Example `firebase-messaging-sw.js`:
```javascript
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({ /* Must copy your config here again! */ });

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background payload incoming', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## 5. Security & Authentication

Firebase Cloud Messaging behaves as a blind push utility. It depends entirely on your Backend's strict execution:
- The Backend safely holds the Service Account JSON (`nutritiffinServiceAccountKey.json`) which dictates authority. This file is safely hidden in `.gitignore`.
- Malicious users cannot send notifications to others unless they compromise both the Service Account Key.
- Ensure that Tokens are kept fresh; Firebase may periodically rotate user FCM Tokens. If `getToken()` returns a fresh string, seamlessly push it back to the `PATCH /users/me/fcm-token` endpoint.
