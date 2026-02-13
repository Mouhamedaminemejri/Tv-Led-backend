# Frontend Sync: Real-Time Konnect Checkout

This doc explains how frontend should integrate with backend checkout for Konnect (D17 / Flouci / e-DINAR style flow).

## Base URL

- Backend API base: `http://localhost:3001/api`

## Main checkout flow

1. Frontend calls `POST /checkout/initiate-payment`
2. Backend creates order + payment record
3. Backend returns `paymentUrl`
4. Frontend redirects user to `paymentUrl`
5. Konnect redirects user back to frontend success/fail pages
6. Backend webhook updates payment/order status asynchronously

## Endpoint: initiate payment

- **URL:** `POST /api/checkout/initiate-payment`
- **Auth:** Optional auth (JWT user or guest token header)
- **Payment method for Konnect:** `MOBILE_PAYMENT`

### Required headers

- For guest checkout: `X-Guest-Token: <uuid>`
- For logged-in user: `Authorization: Bearer <jwt>`

### Request body example

```json
{
  "paymentMethod": "MOBILE_PAYMENT",
  "fullName": "Mohamed Amine Mejri",
  "email": "amine@example.com",
  "phoneNumber": "20123456",
  "cin": "12345678",
  "dateOfBirth": "1998-11-10",
  "billingAddress": {
    "streetAddress": "Rue Tunis",
    "city": "Tunis",
    "postalCode": "1000"
  },
  "shippingAddress": {
    "streetAddress": "Rue Tunis",
    "city": "Tunis",
    "postalCode": "1000"
  }
}
```

### Success response (important fields)

```json
{
  "order": {
    "id": "order-uuid",
    "orderNumber": "ORD-...",
    "status": "PENDING"
  },
  "paymentUrl": "https://...konnect.../pay/...",
  "message": "Mobile payment initiated successfully. Please complete payment."
}
```

### Frontend redirect

```ts
window.location.href = response.paymentUrl;
```

## Endpoint: check payment status

- **URL:** `GET /api/checkout/payment/status?orderId=<orderId>`
- Use this on success page polling if webhook is not yet processed.

Example response:

```json
{
  "paymentStatus": "PENDING",
  "paymentUrl": "https://...",
  "orderStatus": "PENDING"
}
```

`paymentStatus` eventually becomes `SUCCESS` and `orderStatus` becomes `CONFIRMED`.

## Frontend success/fail routes

Backend generates these return URLs for Konnect:

- Success: `<FRONTEND_URL>/checkout/success?orderId=<id>&gateway=konnect`
- Fail: `<FRONTEND_URL>/checkout/fail?orderId=<id>&gateway=konnect`

Your frontend should have both routes and handle query params.

## New backend webhook endpoint

- **URL:** `POST /api/checkout/webhook/konnect`
- Called by Konnect server-to-server
- Backend validates signature when `KONNECT_WEBHOOK_SECRET` is configured

No frontend action is required for webhook endpoint.

## ENV values backend must have

```env
APP_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
KONNECT_API_KEY=your_konnect_api_key
KONNECT_WALLET_ID=your_wallet_id
KONNECT_API_URL=https://api.konnect.network
KONNECT_WEBHOOK_SECRET=your_webhook_secret
```

## Frontend implementation checklist

- Use `MOBILE_PAYMENT` for Konnect flow.
- Redirect to `paymentUrl` immediately after initiate-payment success.
- Build `/checkout/success` and `/checkout/fail` pages.
- On success page, call `/checkout/payment/status` until status is final.
- Show clear UI states: pending / success / failed.
- Keep cart/order IDs in state (or URL params) for retry and tracking.
