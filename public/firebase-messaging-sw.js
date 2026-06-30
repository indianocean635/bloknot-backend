// Firebase Messaging Service Worker
// This file handles background push notifications

// Import Firebase SDK (you'll need to include this in your build process)
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// Firebase configuration (same as in firebase-config.js)
const firebaseConfig = {
  apiKey: "AIzaSyDWZz5AMQq6xiQbAxrAPglWVKndcdGV59E",
  authDomain: "bloknot-ec8ed.firebaseapp.com",
  projectId: "bloknot-ec8ed",
  storageBucket: "bloknot-ec8ed.firebasestorage.app",
  messagingSenderId: "392620505697",
  appId: "1:392620505697:web:109a639b516fdf937c8820",
  measurementId: "G-JR4MFJM78B"
};

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/favicon.png',
    badge: '/favicon.png',
    tag: 'booking-notification',
    data: payload.data,
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'Посмотреть запись'
      },
      {
        action: 'dismiss',
        title: 'Закрыть'
      }
    ]
  };

  // Show the notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received:', event);

  event.notification.close();

  if (event.action === 'view') {
    // Open calendar page when user clicks "Посмотреть запись"
    event.waitUntil(
      clients.openWindow('/calendar')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open calendar
    event.waitUntil(
      clients.openWindow('/calendar')
    );
  }
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event);
  
  // You might want to re-subscribe here
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY_HERE'
    }).then((subscription) => {
      // Send new subscription to server
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription,
          timestamp: new Date().toISOString()
        })
      });
    })
  );
});

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing');
  event.waitUntil(self.skipWaiting());
});

// Service worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating');
  event.waitUntil(self.clients.claim());
});

console.log('[SW] Firebase Messaging Service Worker loaded');
