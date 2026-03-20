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
  
  // Catatan: Firebase Firebase compat library SECARA OTOMATIS akan menampilkan
  // notifikasi jika payload memiliki object `notification`.
  // Kita HANYA perlu meanmpilkan manual jika backend mengirim pure `data` message
  // tanpa object `notification`.
  
  if (!payload.notification) {
    const notificationTitle = payload.data?.title || 'New Update';
    const notificationOptions = {
      body: payload.data?.body || 'You have a new notification.',
      icon: '/assets/icon.png',
      image: payload.data?.image,
      data: {
        url: payload.data?.url || '/'
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// Hendel klik notifikasi background
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Cek jika window sudah kebuka
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf(self.registration.scope) !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Kalo belum buka tab baru
      if (clients.openWindow) {
        return clients.openWindow(clickUrl);
      }
    })
  );
});
