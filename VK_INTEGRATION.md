# VK Integration Documentation

## Overview
This document describes how to set up VK (Vkontakte) integration for user authentication and notifications in the Bloknot booking system.

## Features
- VK ID authentication
- VK notifications for booking confirmations
- VK reminders (24h and 1h before appointment)
- VK notifications for cancellations and reschedules

## Prerequisites
- VK Developer Account
- VK Community (Group) for sending messages
- VK Application created in VK Developer Portal

## Setup Instructions

### 1. Create VK Application

1. Go to [VK Developer Portal](https://vk.com/dev)
2. Create a new application:
   - Platform: Web site
   - Site address: `https://bloknotservis.ru` (or your domain)
   - Callback URL: `https://bloknotservis.ru/auth/vk/callback`
   - Settings: Enable "Open API" and "VK ID"
3. Note down:
   - **App ID** (Client ID)
   - **Client Secret** (Secure key)

### 2. Create VK Community

1. Create a VK Community (Group) if you don't have one
2. Go to Community Settings → API Usage
3. Create API Key:
   - Note down the **Community Token** (Access Token)
   - This token will be used to send messages to users

### 3. Configure Environment Variables

Add the following variables to your `.env` file:

```env
# VK Integration Settings
VK_APP_ID=your_vk_app_id
VK_CLIENT_SECRET=your_vk_client_secret
VK_COMMUNITY_TOKEN=your_vk_community_token
VK_API_VERSION=5.199
VK_NOTIFICATIONS_ENABLED=true
FRONTEND_URL=https://bloknotservis.ru
```

### 4. Database Migration

Run the migration to add VK fields to the database:

```bash
# On the server
cd /var/www/bloknot-backend
npx prisma migrate dev --name add_vk_fields
```

This will add:
- `customerVkId` field to Appointment model
- `vkReminderSent24h` field to Appointment model
- `vkReminderSent1h` field to Appointment model

### 5. Restart the Application

```bash
pm2 restart bloknot
```

## API Endpoints

### VK Authentication

#### Callback URL
```
GET /api/vk/callback?code={code}&device_id={device_id}&state={state}
```
- Called by VK after user authorization
- Automatically creates or updates user account
- Redirects to frontend with session token

#### Link VK Account
```
POST /api/vk/link
Authorization: Bearer {session_token}
Body: { "code": "authorization_code" }
```
- Links VK account to existing user
- Requires authentication

#### Unlink VK Account
```
POST /api/vk/unlink
Authorization: Bearer {session_token}
```
- Unlinks VK account from user
- Requires authentication

#### Get VK Status
```
GET /api/vk/status
Authorization: Bearer {session_token}
```
- Returns VK connection status
- Response: `{ "isVkConnected": true/false, "vkUserId": "123456" }`

## Usage

### Client-Side Integration

To add VK login button to your frontend:

```html
<script src="https://unpkg.com/@vkid/sdk/dist/vkid-sdk.min.js"></script>
<script>
  VKID.Widget.create({
    app_id: YOUR_VK_APP_ID,
    redirect_url: 'https://bloknotservis.ru/auth/vk/callback',
    state: 'random_string',
    code_auth: true,
    onAuth: (data) => {
      // Handle successful authentication
      console.log('VK Auth successful:', data);
    }
  }).mount('#vk-login-button');
</script>
<div id="vk-login-button"></div>
```

### Sending VK Notifications

When creating a booking, include `vkUserId` in the request:

```javascript
POST /api/appointments/public
Body: {
  "customerName": "John Doe",
  "customerPhone": "+79991234567",
  "vkUserId": "123456789",
  "serviceId": 1,
  "masterId": 1,
  "startsAt": "2026-06-10T10:00:00Z",
  "endsAt": "2026-06-10T11:00:00Z",
  "businessId": "business-id"
}
```

### VK Notification Types

The system automatically sends:

1. **Booking Confirmation**
   - Sent immediately after booking creation
   - Includes: date, time, specialist, service, booking link

2. **24h Reminder**
   - Sent 24 hours before appointment
   - Includes: date, time, specialist, service, booking link

3. **1h Reminder**
   - Sent 1 hour before appointment
   - Includes: date, time, specialist, service, booking link

4. **Cancellation**
   - Sent when appointment is cancelled
   - Includes: original date, time, specialist, service, booking link

5. **Reschedule**
   - Sent when appointment time/date is changed
   - Includes: new date, time, specialist, service, booking link

## Message Templates

### Booking Confirmation
```
Здравствуйте, {customer_name}!

Ваша запись подтверждена ✅

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}
```

### 24h Reminder
```
Здравствуйте, {customer_name}!

Напоминаем, что у вас запись завтра ✅

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}
```

### 1h Reminder
```
Здравствуйте, {customer_name}!

Напоминаем, что ваша запись через час ✅

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}
```

### Cancellation
```
Здравствуйте, {customer_name}!

Ваша запись была отменена ❌

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Записаться снова:
{booking_link}
```

### Reschedule
```
Здравствуйте, {customer_name}!

Ваша запись была перенесена ✅

📅 Новая дата: {date}
🕒 Новое время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}
```

## Troubleshooting

### VK Notifications Not Sending

1. Check environment variables:
   ```bash
   pm2 env 0 | grep VK
   ```

2. Check logs:
   ```bash
   pm2 logs bloknot --lines 50
   ```

3. Verify VK Community Token is valid:
   - Token should have "messages" permission
   - Token should not be expired

4. Check VK API status:
   - Visit [VK API Status](https://vk.com/dev/health)

### VK Authentication Fails

1. Verify App ID and Client Secret are correct
2. Check Callback URL matches VK App settings
3. Ensure Redirect URI is properly configured

### User Not Receiving Messages

1. Verify user has VK account linked
2. Check `customerVkId` is set in appointment record
3. Ensure VK Community can send messages to user
4. Check user hasn't blocked the community

## Security Notes

- Never commit VK secrets to version control
- Use environment variables for all sensitive data
- Rotate VK Community Tokens periodically
- Monitor VK API usage for abuse

## Support

For issues related to:
- VK API: [VK Developer Support](https://vk.com/dev/support)
- Application integration: Check application logs
- Database issues: Check Prisma migration status
