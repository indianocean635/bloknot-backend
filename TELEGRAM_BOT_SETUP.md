# Telegram Bot Setup Guide

## Problem Solved

1. **409 Conflict Error**: Multiple bot instances running simultaneously
2. **Missing Buttons**: Confirmation messages lacked cancel/reschedule options

## New Bot Service Features

### ✅ Confirmation Messages with Action Buttons
- **Cancel Booking**: Users can cancel their appointments directly from Telegram
- **Reschedule Booking**: Users get a link to reschedule their appointments
- **Rich Information**: Shows service, specialist, date, time, and business details

### ✅ Conflict Resolution
- Automatic detection of running bot instances
- Graceful shutdown of existing instances
- Health check server on port 8080
- Proper error handling for 409 conflicts

### ✅ Reminder System
- Automatic reminders 24 hours and 1 hour before appointments
- Configurable reminder intervals
- Fallback handling if Telegram API is unavailable

## Quick Start

### 1. Stop All Existing Bot Instances
```bash
node manage-bot.js stop
```

### 2. Start the New Bot Service
```bash
node manage-bot.js start
```

### 3. Check Bot Status
```bash
node manage-bot.js status
```

### 4. Restart (Recommended for fixing issues)
```bash
node manage-bot.js restart
```

## Bot Service Commands

| Command | Description |
|---------|-------------|
| `node manage-bot.js start` | Start the bot service |
| `node manage-bot.js stop` | Stop all bot instances |
| `node manage-bot.js restart` | Restart bot service (fixes 409 conflicts) |
| `node manage-bot.js status` | Check if bot is running and healthy |

## How It Works

### Booking Confirmation Flow
1. User creates booking through web form
2. User clicks Telegram link (deep-link with booking token)
3. Bot receives `/start` command with token
4. Bot links chat ID to booking in database
5. Bot sends confirmation message with action buttons:
   - ❌ Отменить запись (Cancel Booking)
   - 🔄 Перенести запись (Reschedule Booking)

### Button Actions
- **Cancel**: Calls backend API to cancel booking, updates status to 'CANCELLED'
- **Reschedule**: Generates reschedule link and sends it to user

### Conflict Prevention
- Bot checks for existing webhook/instances before starting
- Automatically removes webhook if set (switches to polling)
- Graceful shutdown on SIGINT/SIGTERM
- Health check endpoint for monitoring

## Environment Variables

Make sure these are set in your `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
HTTPS_PROXY=optional_proxy_url
HTTP_PROXY=optional_proxy_url
ENABLE_REMINDERS=true
```

## Troubleshooting

### 409 Conflict: "terminated by other getUpdates request"
**Solution**: Run `node manage-bot.js restart`

This will:
1. Stop all existing bot instances
2. Wait for processes to fully terminate
3. Start the new bot service
4. Verify health status

### Bot Not Responding
**Check**: 
1. Run `node manage-bot.js status`
2. Verify bot token is correct
3. Check if port 8080 is available
4. Review logs for error messages

### Buttons Not Working
**Check**:
1. Verify booking token is valid
2. Check if booking has `telegramChatId` set
3. Ensure backend API endpoints are accessible

## API Endpoints Used by Bot

- `POST /api/telegram/link-booking` - Link chat ID to booking
- `POST /api/telegram/cancel-booking` - Cancel booking
- `POST /api/telegram/reschedule-link` - Get reschedule URL
- `POST /api/telegram/send-reminders` - Get pending reminders

## Health Monitoring

The bot service includes a health check server:
- **URL**: `http://localhost:8080/health`
- **Response**: `{ "status": "ok", "timestamp": "..." }`

## Migration from Old Bot

1. Stop any existing bot processes
2. Deploy the new `telegramBotService.js`
3. Use `manage-bot.js` to control the service
4. Update any container configurations to use the new service

## Container Deployment

If running in Docker/container:

```dockerfile
# Add to your Dockerfile
COPY services/telegramBotService.js /app/services/
COPY manage-bot.js /app/

# Start command
CMD ["node", "services/telegramBotService.js"]
```

Or use the manager:
```dockerfile
CMD ["node", "manage-bot.js", "start"]
```

## Testing

Test the bot flow:
1. Create a test booking
2. Use the Telegram link provided
3. Verify confirmation message with buttons appears
4. Test cancel and reschedule functionality

## Support

If you encounter issues:
1. Check bot status: `node manage-bot.js status`
2. Restart the service: `node manage-bot.js restart`
3. Review console logs for error messages
4. Verify all environment variables are set
