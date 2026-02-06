// Scripts for background handling using Firebase compat libraries
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBDYrFZRKIaJP7DZD-pvAS-AVl1U_cm-8o",
  authDomain: "archazzbook-notif.firebaseapp.com",
  projectId: "archazzbook-notif",
  storageBucket: "archazzbook-notif.firebasestorage.app",
  messagingSenderId: "321570613468",
  appId: "1:321570613468:web:52bfc20b0dc4d8b61d2c19"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Background Message Handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/icon.png', // Fallback icon path
    image: payload.notification.image
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
