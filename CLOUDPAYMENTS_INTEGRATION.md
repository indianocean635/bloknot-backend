# CloudPayments Integration Documentation

## Overview
CloudPayments payment system integrated into existing tariff system without breaking current logic.

## Changes Made

### 1. Environment Variables Added (.env.example)
```
CLOUDPAYMENTS_PUBLIC_ID=your-cloudpayments-public-id
CLOUDPAYMENTS_API_SECRET=your-cloudpayments-api-secret
```

### 2. Database Schema Changes (prisma/schema.prisma)
**Table: Subscription**
Added fields:
- `subscriptionStatus` (String, default: "TRIAL") - TRIAL, ACTIVE, CANCELLED, EXPIRED
- `trialEndsAt` (DateTime?) - End date of trial period
- `subscriptionEndsAt` (DateTime?) - End date of subscription
- `cloudpaymentsSubscriptionId` (String?, unique) - CloudPayments subscription ID
- `nextPaymentDate` (DateTime?) - Next recurring payment date
- `billingPeriod` (String?) - MONTHLY or YEARLY
- `lastPaymentAt` (DateTime?) - Last successful payment date
- `usersLimit` (Int, default: 1) - Same as maxUsers for compatibility

**Migration file:** `prisma/migrations/20260605100000_add_cloudpayments_fields/migration.sql`

### 3. New Backend Files

#### Controller: controllers/paymentController.js
Functions:
- `createPayment()` - Creates payment with CloudPayments API
- `handleCloudPaymentsWebhook()` - Handles CloudPayments webhooks
- `verifyCloudPaymentsSignature()` - Verifies webhook signature
- `handlePaymentSuccess()` - Handles successful payment
- `handlePaymentConfirm()` - Handles payment confirmation
- `handlePaymentFail()` - Handles payment failure
- `handleSubscriptionCancel()` - Handles subscription cancellation
- `handleRecurrentPayment()` - Handles recurring payments
- `handleRefund()` - Handles refunds

#### Routes: routes/paymentRoutes.js
Endpoints:
- `POST /api/payments/create` - Create payment (requires auth)
- `POST /api/payments/cloudpayments/webhook` - CloudPayments webhook (no auth)

### 4. Backend Changes

#### index.js
- Added paymentRoutes import
- Registered paymentRoutes at `/api`

### 5. Frontend Changes

#### public/pricing.html
- Added CloudPayments widget script: `<script src="https://widget.cloudpayments.ru/bundles/cloudpayments"></script>`
- Updated `processCardPayment()` function to call `/api/payments/create` API
- Integrated CloudPayments widget for card payments
- Plan mapping: Solo → solo, Studio → studio, Pro → pro

#### public/settings.html
- Added CloudPayments widget script: `<script src="https://widget.cloudpayments.ru/bundles/cloudpayments"></script>`
- Updated `processPayment()` function to call `/api/payments/create` API
- Integrated CloudPayments widget for card payments
- Removed manual card input fields (now handled by widget)
- Plan mapping: SOLO → solo, STUDIO → studio, PRO → pro

## Tariff Configuration

### Monthly Plans (Recurring + Trial)
- **solo**: 690₽/month, 1 user, 5 days trial
- **studio**: 990₽/month, 5 users, 5 days trial
- **pro**: 1490₽/month, 15 users, 5 days trial

**Monthly Flow:**
1. User selects monthly plan
2. Card is bound via CloudPayments widget
3. Trial starts immediately (5 days)
4. First payment after trial ends
5. Recurring monthly payments thereafter

### Yearly Plans (One-time Payment)
- **solo_year**: 6624₽/year (20% discount), 1 user
- **studio_year**: 9504₽/year (20% discount), 5 users
- **pro_year**: 14304₽/year (20% discount), 15 users

**Yearly Flow:**
1. User selects yearly plan
2. Immediate payment via CloudPayments widget
3. Subscription active for 365 days
4. No recurring payments

## Webhook Events Handled

- **Pay** - Successful payment
- **Confirm** - Payment confirmation
- **Fail** - Payment failure
- **Cancel** - Subscription cancellation
- **Recurrent** - Recurring payment
- **Refund** - Refund processed

## Logging

All payment operations log:
- `[PAYMENT CREATED]` - Payment creation initiated
- `[TRIAL STARTED]` - Trial period started
- `[SUBSCRIPTION CREATED]` - Subscription created
- `[PAYMENT SUCCESS]` - Payment successful
- `[RECURRING SUCCESS]` - Recurring payment successful
- `[PAYMENT FAILED]` - Payment failed
- `[CLOUDPAYMENTS WEBHOOK]` - Webhook received
- `[CLOUDPAYMENTS REQUEST]` - API request to CloudPayments

## Security Features

- Signature verification for webhooks
- Protection against duplicate webhooks
- JWT authentication for payment creation
- Business ID isolation

## Testing

### Monthly Scenario Test
1. Go to pricing page or settings
2. Select "1 месяц" period
3. Choose Solo/Studio/Pro plan
4. Click "Оплатить картой"
5. CloudPayments widget opens
6. Enter test card data
7. Verify trial starts (5 days)
8. Check subscription status in DB: `subscriptionStatus = TRIAL`
9. After 5 days, verify first payment charged
10. Check subscription status: `subscriptionStatus = ACTIVE`

### Yearly Scenario Test
1. Go to pricing page
2. Select "12 месяцев" period
3. Choose Solo/Studio/Pro plan
4. Click "Оплатить картой"
5. CloudPayments widget opens
6. Enter test card data
7. Verify immediate payment
8. Check subscription status in DB: `subscriptionStatus = ACTIVE`
9. Check `subscriptionEndsAt` = 365 days from now
10. Verify no recurring payment scheduled

### Webhook Test
1. Use CloudPayments test environment
2. Trigger test webhooks
3. Verify webhook signature verification
4. Check logs for webhook processing
5. Verify subscription status updates

## Migration Instructions

1. Add ENV variables to `.env`:
   ```
   CLOUDPAYMENTS_PUBLIC_ID=your-public-id
   CLOUDPAYMENTS_API_SECRET=your-api-secret
   ```

2. Run database migration:
   ```bash
   npx prisma migrate deploy
   ```

3. Restart backend:
   ```bash
   pm2 restart bloknot-backend
   ```

4. Configure CloudPayments webhook URL:
   ```
   https://your-domain.com/api/payments/cloudpayments/webhook
   ```

## Important Notes

- Existing tariff logic is NOT changed
- Current subscription system remains functional
- CloudPayments is an ADDITION, not replacement
- Trial period is 5 days (changed from 7 days)
- All existing checks and limits work as before
- Frontend works in both places: pricing page and settings
