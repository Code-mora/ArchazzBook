import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getMessaging, getToken, onMessage, deleteToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

// 1. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBDYrFZRKIaJP7DZD-pvAS-AVl1U_cm-8o",
  authDomain: "archazzbook-notif.firebaseapp.com",
  projectId: "archazzbook-notif",
  storageBucket: "archazzbook-notif.firebasestorage.app",
  messagingSenderId: "321570613468",
  appId: "1:321570613468:web:52bfc20b0dc4d8b61d2c19"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 2. Helper: Generate or Get Browser ID (UUID)
export function getBrowserId() {
  let bid = localStorage.getItem('archazz_browser_id');
  if (!bid) {
    bid = crypto.randomUUID();
    localStorage.setItem('archazz_browser_id', bid);
  }
  return bid;
}

// 2b. Helper: Hard Reset Service Worker & Token & Cache
async function hardReset() {
  console.log('🧹 Performing Hard Reset (Nuclear Option)...');
  try {
    // 1. Delete Token
    if (messaging) await deleteToken(messaging).catch(() => {});
    
    // 2. Unregister ALL Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log('🔥 Unregistering SW:', registration.scope);
        await registration.unregister();
      }
    }

    // 3. Clear Cache Storage
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        console.log('🗑️ Deleting Cache:', key);
        await caches.delete(key);
      }
    }
    
    console.log('✨ Cleanup complete. Reloading soon...');
  } catch (err) {
    console.warn('Cleanup warning:', err);
  }
}

// 3. Exported Function: Request Permission & Save Token
export async function setupNotifications(vapidKey) {
  try {
    console.log('🔔 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('✅ Permission granted. Starting sequence...');
      
      // REGISTER & WAIT FOR SERVICE WORKER
      try {
        let swReg;
        try {
           swReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        } catch (e) {
           console.error('❌ SW Register Failed:', e);
           throw e;
        }

        const registration = await navigator.serviceWorker.ready;

        // Get FCM Token
        const currentToken = await getToken(messaging, { 
          vapidKey: vapidKey,
          serviceWorkerRegistration: registration 
        });

        if (currentToken) {
          console.log('🎟️ FCM Token:', currentToken);
          // Save to Supabase
          await saveTokenToSupabase(currentToken);
          return true;
        } else {
          console.warn('⚠️ No registration token available.');
          return false;
        }

      } catch (err) {
        console.error('An error occurred while retrieving token/sw: ', err);
        console.log('🔄 Trying Auto-Fix (Reset & Retry)...');
        
        // AUTO-FIX: Reset and Retry
        await hardReset();
        
        // ATTEMPT 2: Fresh Start after Reset
        try {
          const freshReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
          await navigator.serviceWorker.ready;
          
          const freshToken = await getToken(messaging, { 
            vapidKey: vapidKey,
            serviceWorkerRegistration: freshReg 
          });

          if (freshToken) {
            console.log('🎟️ FCM Token (Retry Success):', freshToken);
            await saveTokenToSupabase(freshToken);
            return true;
          }
        } catch (retryErr) {
          console.error('❌ Retry failed too:', retryErr);
          throw retryErr;
        }
      }

    } else {
      console.warn('🚫 Notification permission denied.');
      return false;
    }
  } catch (err) {
    console.error('❌ Critical Setup Error:', err);
    return false;
  }
}

// 4. Save Token to Supabase
async function saveTokenToSupabase(token) {
  try {
      const browserId = getBrowserId();
      // Truncate user agent just in case
      const deviceInfo = navigator.userAgent.substring(0, 200);

      // Check if Supabase client is available (from window object)
      if (!window.supabaseClient) {
        alert('❌ Error: Supabase Client not ready!');
        console.error('❌ Supabase client not found!');
        return;
      }

      console.log('💾 Saving token to Supabase...', { browserId });
      // alert('Debug: Saving to DB... ' + browserId.slice(0,5));

      const { error } = await window.supabaseClient
        .from('fcm_tokens')
        .upsert({ 
          browser_id: browserId, 
          fcm_token: token,
          device_info: deviceInfo,
          last_active: new Date().toISOString()
        }, { onConflict: 'browser_id' });

      if (error) {
        alert('❌ DB Error: ' + error.message + ' (' + error.code + ')');
        console.error('❌ Error saving token to Supabase:', error);
      } else {
        console.log('✅ Token saved to Supabase!');
        // alert('✅ Token Saved to DB!'); // Uncomment if needed
      }
  } catch (err) {
      alert('❌ DB Exception: ' + err.message);
  }
}

// 5. Listen for incoming messages (foreground)
onMessage(messaging, (payload) => {
  console.log('📩 Message received (foreground): ', payload);
  // Customize how you want to show the notification in the app
  // e.g., show a toast or custom alert
  showInAppNotification(payload);
});

function showInAppNotification(payload) {
  const { title, body, image } = payload.notification || {};
  // Simple alert for now, can be upgraded to custom UI
  alert(`🔔 ${title}\n\n${body}`);
}

// Make functions available globally for non-module scripts if needed
window.NotifManager = {
  setup: setupNotifications,
  getBrowserId: getBrowserId,
  hardReset: hardReset
};

// AUTO-RESET CHECK
if (window.location.search.includes('reset=true')) {
    // Need to wrap in async IIFE
    (async () => {
        alert('🔁 RESET MODE DETECTED. Nuclear Cleanup...');
        await hardReset();
        localStorage.clear(); // Clear storage too
        alert('✅ App Reset Complete. Reloading fresh...');
        window.location.href = window.location.pathname;
    })();
}

// AUTO-ATTACH Listener (To avoid inline script issues)
console.log('📜 Notifications Script Loaded. Looking for buttons...');
const btnAllow = document.getElementById('btn-allow');
const btnDismiss = document.getElementById('btn-dismiss');
const banner = document.getElementById('notification-banner');

if (btnAllow) {
  console.log('✅ Found Allow Button. Attaching listener...');
  btnAllow.addEventListener('click', async () => {
      // alert('🖱️ CLICK DETECTED (from module)!'); // Removed debug
      if (banner) banner.style.display = 'none';
      
      // VAPID Key provided by user (Updated)
      const vapidKey = 'BFkoF2BLu0eulaqu3HxgJVFMJ-hHYFPSfMGvt0Lr1PzFag39n0K6YSOQ0LHTaLg0CHHNHoJXEbXrk1j1OgSiHfI'; 
      
      try {
          const success = await setupNotifications(vapidKey);
          if (success) {
              localStorage.setItem('archazz_notif_status', 'granted');
              alert('✅ Notifications enabled! You will now receive updates.');
          }
      } catch (err) {
          console.error('Setup failed:', err);
          alert('Failed to enable notifications. Check console for details.');
      }
  });
} else {
  console.log('⚠️ Allow Button NOT found (yet).');
}

if (btnDismiss) {
  btnDismiss.addEventListener('click', () => {
      if (banner) banner.style.display = 'none';
      localStorage.setItem('archazz_notif_status', 'dismissed');
  });
}

// Show banner logic
const notifStatus = localStorage.getItem('archazz_notif_status');
if (!notifStatus && Notification.permission === 'default' && banner) {
    setTimeout(() => {
        banner.style.display = 'flex';
    }, 3000); 
}
