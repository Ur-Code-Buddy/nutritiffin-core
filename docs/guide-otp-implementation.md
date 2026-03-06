# MessageCentral OTP API Integration

## Overview

This document describes how to integrate **MessageCentral CPaaS OTP verification** in the backend.

The flow consists of two steps:

1. **Send OTP** to the user's mobile number
2. **Validate OTP** entered by the user

All API requests must include the **`authToken` header**.

---

# Base API

```
https://cpaas.messagecentral.com/verification/v3
```

---

# Authentication

All requests must include the following header:

```
authToken: <YOUR_AUTH_TOKEN>
```

Example:

```
--header 'authToken: eyJhbGciOiJIUzUxMiJ9....'
```

---

# 1. Send OTP

This API sends an OTP to the provided mobile number.

### Endpoint

```
POST /send
```

### Full Request

```
https://cpaas.messagecentral.com/verification/v3/send
```

### Query Parameters

| Parameter    | Type   | Description                     |
| ------------ | ------ | ------------------------------- |
| customerId   | string | MessageCentral customer ID      |
| mobileNumber | string | User phone number               |
| countryCode  | string | Country code (ex: 91 for India) |
| flowType     | string | OTP delivery type (SMS)         |
| otpLength    | number | Length of OTP                   |

### Example Request

```
POST https://cpaas.messagecentral.com/verification/v3/send?customerId=C-E281A96ED2B54AC&mobileNumber=8838087085&countryCode=91&flowType=SMS&otpLength=4
```

### Example Response

```
{
  "responseCode": 200,
  "message": "SUCCESS",
  "data": {
    "verificationId": "5915384",
    "mobileNumber": "8838087085",
    "responseCode": "200",
    "timeout": "60.0",
    "transactionId": "2065cc84-0d76-40fe-a434-2f1907ef07a2",
    "referenceId": "JRN-1afe057e-d7f9-483c-8673-246defaa4ea4",
    "flowType": "SMS"
  }
}
```

### Important Fields

| Field          | Description                    |
| -------------- | ------------------------------ |
| verificationId | Unique ID used to validate OTP |
| timeout        | OTP validity in seconds        |

Store the **verificationId** temporarily for OTP validation.

---

# 2. Validate OTP

This API verifies the OTP entered by the user.

### Endpoint

```
GET /validateOtp
```

### Full Request

```
https://cpaas.messagecentral.com/verification/v3/validateOtp
```

### Query Parameters

| Parameter      | Type   | Description                   |
| -------------- | ------ | ----------------------------- |
| verificationId | string | ID received from Send OTP API |
| code           | string | OTP entered by the user       |

### Example Request

```
https://cpaas.messagecentral.com/verification/v3/validateOtp?verificationId=5915384&code=183099
```

### Example Response

```
{
  "responseCode": 200,
  "message": "SUCCESS",
  "data": {
    "verificationId": 5915384,
    "mobileNumber": "8838087085",
    "verificationStatus": "VERIFICATION_COMPLETED",
    "responseCode": "200",
    "errorMessage": null,
    "transactionId": "2065cc84-0d76-40fe-a434-2f1907ef07a2",
    "referenceId": "JRN-1afe057e-d7f9-483c-8673-246defaa4ea4",
    "authToken": null
  }
}
```

### Success Condition

OTP is valid when:

```
verificationStatus = "VERIFICATION_COMPLETED"
```

---

# Complete OTP Flow

1. Client sends mobile number to backend
2. Backend calls **Send OTP API**
3. Backend stores `verificationId`
4. User enters OTP
5. Backend calls **Validate OTP API**
6. If `verificationStatus == VERIFICATION_COMPLETED`
7. Mark phone number as verified

---

# Notes for Implementation

* OTP expires based on the `timeout` field (usually 60 seconds)
* `verificationId` must be stored temporarily (Redis / memory / DB)
* Always validate OTP server-side
* Do not expose `authToken` to frontend
* Handle error cases such as:

  * expired OTP
  * invalid OTP
  * rate limiting

---

# Expected Backend Functions

```
sendOtp(mobileNumber)

verifyOtp(verificationId, otpCode)
```

---

# Example Backend Flow

```
POST /auth/send-otp
body:
{
  "mobileNumber": "8838087085"
}
```

```
POST /auth/verify-otp
body:
{
  "verificationId": "5915384",
  "otp": "183099"
}
```
