# Push Notifications Setup Guide

## 🎯 Overview
This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in the Bloknot application.

## 🔥 Firebase Project Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `bloknot-push-notifications`
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Get Firebase Configuration
1. In Firebase Console, go to Project Settings
2. Under "Your apps", click "Web" (</> icon)
3. Enter app nickname: `Bloknot Web App`
4. Click "Register app"
5. Copy the Firebase configuration object

### 3. Generate VAPID Keys
1. In Project Settings, go to "Cloud Messaging"
2. Under "Web configuration", click "Generate key pair"
3. Copy the public key (starts with `BKagOny0KF_...`)

## 📱 Update Configuration Files

### 1. Update `public/firebase-config.js`
Replace the placeholder values with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 2. Update VAPID Key
In the same file, replace the VAPID key:

```javascript
const token = await this.messaging.getToken({
  vapidKey: "YOUR_VAPID_PUBLIC_KEY_HERE" // Replace with actual key
});
```

### 3. Update Service Worker
In `public/firebase-messaging-sw.js`, update the Firebase config with the same values.

## 🗄️ Database Migration

Apply the database migration to create the PushSubscription table:

```bash
# On production server:
psql -U your_username -d bloknot -f migrations/add-push-subscriptions.sql

# Or using Prisma (if database is accessible):
npx prisma migrate dev --name add-push-subscriptions
npx prisma generate
```

## 🚀 Deploy Changes

### 1. Commit and Push Changes
```bash
git add -A
git commit -m "Add Firebase push notifications support"
git push origin main
```

### 2. Update Production Server
```bash
# On production server:
cd /var/www/bloknot-backend
git pull origin main
npm install
pm2 restart bloknot
```

## 📱 Testing Push Notifications

### 1. Enable Notifications in Browser
1. Open your application in Chrome/Firefox
2. Go to Calendar page
3. Allow notifications when prompted
4. Check browser console for "Push notifications subscribed successfully"

### 2. Test Appointment Creation
1. Create a new appointment in the calendar
2. Check console logs for push notification sent
3. You should see a notification if Firebase is properly configured

### 3. Test Online Booking
1. Use the public booking form to create an appointment
2. Check for push notification about new online booking

## 🔧 Firebase Admin SDK (Optional)

For production use, you'll want to integrate the Firebase Admin SDK to actually send notifications:

### 1. Install Firebase Admin SDK
```bash
npm install firebase-admin
```

### 2. Initialize Admin SDK
Create `services/firebaseService.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin.messaging();
```

### 3. Update Push Routes
Replace the logging in `routes/pushRoutes.js` with actual Firebase sending:

```javascript
const admin = require('../services/firebaseService');

async function sendPushNotification(businessId, title, body, data = {}) {
  // ... existing code ...
  
  // Send via Firebase
  const message = {
    notification: { title, body },
    data: data,
    tokens: subscriptions.map(s => s.token)
  };
  
  const response = await admin.messaging().sendMulticast(message);
  return response;
}
```

## 📱 Mobile App Support

The same push notification system works with:
- **PWA (Progressive Web Apps)** - Already supported
- **Android Apps** - Need Firebase SDK integration
- **iOS Apps** - Need APNS + Firebase integration

## 🔍 Troubleshooting

### Common Issues:
1. **Notifications not working**: Check browser permissions and console errors
2. **Firebase config error**: Verify API keys and project ID
3. **VAPID key error**: Regenerate keys in Firebase Console
4. **Database error**: Apply migration correctly
5. **Service worker error**: Check `firebase-messaging-sw.js` is accessible

### Debug Commands:
```javascript
// Check notification permission
Notification.permission

// Check service worker registration
navigator.serviceWorker.getRegistrations()

// Test Firebase in console
firebase.messaging().getToken()
```

## 📋 Next Steps

1. ✅ Create Firebase project
2. ✅ Update configuration files  
3. ✅ Apply database migration
4. ✅ Test basic functionality
5. 🔄 Integrate Firebase Admin SDK (for production)
6. 🔄 Add notification preferences settings
7. 🔄 Add notification history/logs

## 🎉 Expected Results

After setup, users will receive:
- 📅 "Новая запись" - when appointments are created in admin panel
- 🌐 "Новая онлайн-запись" - when customers book via public form
- 🔔 Real-time notifications on desktop and mobile devices
