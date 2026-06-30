// Firebase Configuration for Push Notifications
const firebaseConfig = {
  apiKey: "AIzaSyDWZz5AMQq6xiQbAxrAPglWVKndcdGV59E",
  authDomain: "bloknot-ec8ed.firebaseapp.com",
  projectId: "bloknot-ec8ed",
  storageBucket: "bloknot-ec8ed.firebasestorage.app",
  messagingSenderId: "392620505697",
  appId: "1:392620505697:web:109a639b516fdf937c8820",
  measurementId: "G-JR4MFJM78B"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}

// Push Notification Service
class PushNotificationService {
  constructor() {
    this.messaging = null;
    this.token = null;
    this.isSupported = false;
  }

  async init() {
    try {
      // Check if Firebase Messaging is supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications are not supported');
        return false;
      }

      // Initialize Firebase Messaging
      if (typeof firebase !== 'undefined' && firebase.messaging) {
        this.messaging = firebase.messaging();
        this.isSupported = true;
        console.log('Firebase Messaging initialized');
        return true;
      }
    } catch (error) {
      console.error('Error initializing Firebase Messaging:', error);
    }
    return false;
  }

  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  async getToken() {
    try {
      if (!this.messaging) {
        console.log('Firebase Messaging not initialized');
        return null;
      }

      // Register service worker and get token
      const token = await this.messaging.getToken({
        vapidKey: "BPcxpYCoW1y1V-n37jbYBfmvLCbF4PQhazy0nx_Phig459PIb1BRh3HscjqQFDCyeZ3gFz2xLXk6qCa-fLL5s1s"
      });

      this.token = token;
      console.log('FCM Token:', token);
      
      // Send token to server
      await this.sendTokenToServer(token);
      
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  async sendTokenToServer(token) {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('Token sent to server successfully');
      } else {
        console.error('Failed to send token to server');
      }
    } catch (error) {
      console.error('Error sending token to server:', error);
    }
  }

  async setupMessageHandler() {
    if (!this.messaging) return;

    // Handle incoming messages
    this.messaging.onMessage((payload) => {
      console.log('Received push message:', payload);
      
      // Show notification
      if (payload.notification) {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: payload.notification.icon || '/favicon.png',
          badge: '/favicon.png',
          tag: 'booking-notification',
          data: payload.data
        });
      }
    });

    // Handle token refresh
    this.messaging.onTokenRefresh(async () => {
      console.log('Token refreshed');
      const newToken = await this.getToken();
      if (newToken) {
        await this.sendTokenToServer(newToken);
      }
    });
  }

  async subscribe() {
    if (!this.isSupported) {
      console.log('Push notifications not supported');
      return false;
    }

    try {
      // Request permission
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.log('Notification permission denied');
        return false;
      }

      // Get token
      const token = await this.getToken();
      if (!token) {
        console.log('Failed to get FCM token');
        return false;
      }

      // Setup message handler
      this.setupMessageHandler();

      console.log('Push notifications subscribed successfully');
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    }
  }
}

// Global push notification service
window.pushNotificationService = new PushNotificationService();

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  // Only initialize on pages that need push notifications
  if (window.location.pathname.includes('/calendar') || 
      window.location.pathname.includes('/settings') ||
      window.location.pathname.includes('/admin')) {
    
    await window.pushNotificationService.init();
    
    // Auto-subscribe for calendar pages
    if (window.location.pathname.includes('/calendar')) {
      setTimeout(() => {
        window.pushNotificationService.subscribe();
      }, 2000);
    }
  }
});
