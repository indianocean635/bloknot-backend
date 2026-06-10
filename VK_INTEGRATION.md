# VK Integration Documentation

## Overview
This document describes how to set up VK (Vkontakte) integration for user authentication and notifications in the Bloknot booking system.

## Features
- VK ID authentication
- VK notifications for booking confirmations
- VK reminders (24h and 1h before appointment)
- VK notifications for cancellations and reschedules
- Messages sent via VK Community API

## Prerequisites
- VK Developer Account
- VK Community (Group) for sending messages
- VK Application created in VK Developer Portal

## Setup Instructions

### 1. Create VK Community

1. Create a VK Community (Group) if you don't have one
2. Go to Community Settings → API Usage
3. Create API Key:
   - Note down the **Group ID** (e.g., 238506692)
   - Note down the **Access Token** (Community Token)
   - This token will be used to send messages to users

### 2. Configure Environment Variables

Add the following variables to your `.env` file:

```env
# VK Integration Settings
VK_GROUP_ID=238506692
VK_ACCESS_TOKEN=your_vk_access_token
VK_API_VERSION=5.199
VK_NOTIFICATIONS_ENABLED=true
FRONTEND_URL=https://bloknotservis.ru
```

### 3. Database Migration

Run the migration to add VK fields to the database:

```bash
# On the server
cd /var/www/bloknot-backend
npx prisma migrate dev --name add_vk_fields
```

This will add:
- `customerVkId` field to Appointment model
- `vkConnectedAt` field to Appointment model
- `vkReminderSent24h` field to Appointment model
- `vkReminderSent1h` field to Appointment model

### 4. Restart the Application

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
- Response: `{ "isVkConnected": true/false, "vkUserId": "12345" }`

#### Test VK Message
```
POST /api/vk/test-message
Authorization: Bearer {session_token}
Body: { "vkUserId": "123456789" }
```
- Sends a test message to the specified VK user
- Requires authentication
- Response: `{ "success": true, "message": "Test message sent successfully" }`

## Usage

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
Ваша запись подтверждена ✅

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}

Ждём вас ❤️
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

3. Verify VK Access Token is valid:
   - Token should have "messages" permission
   - Token should not be expired

4. Check VK API status:
   - Visit [VK API Status](https://vk.com/dev/health)

### User Not Receiving Messages

1. Verify user has VK account linked
2. Check `customerVkId` is set in appointment record
3. Ensure VK Community can send messages to user
4. Check user hasn't blocked the community

## Security Notes

- Never commit VK secrets to version control
- Use environment variables for all sensitive data
- Rotate VK Access Tokens periodically
- Monitor VK API usage for abuse

## Support

For issues related to:
- VK API: [VK Developer Support](https://vk.com/dev/support)
- Application integration: Check application logs
- Database issues: Check Prisma migration status
