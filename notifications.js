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

// 2b. Helper: Hard Reset Service Worker & Token
async function hardReset() {
  console.log('🧹 Performing Hard Reset...');
  try {
    // 1. Delete Token
    await deleteToken(messaging).catch(() => {});
    // 2. Unregister ALL Service Workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log('✨ Cleanup complete.');
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
        alert('Step 1: SW Registration Start...');
        
        let swReg;
        try {
           swReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
           alert('Step 2: SW Registered.');
        } catch (e) {
           alert('❌ SW Register Failed: ' + e.message);
           throw e;
        }

        alert('Step 3: Waiting for SW Ready...');
        const registration = await navigator.serviceWorker.ready;
        alert('Step 4: SW Ready!');

        // Get FCM Token
        alert('Step 5: Getting Token...');
        const currentToken = await getToken(messaging, { 
          vapidKey: vapidKey,
          serviceWorkerRegistration: registration 
        });

        if (currentToken) {
          alert('Step 6: Token Got! ' + currentToken.slice(0, 10) + '...');
          console.log('🎟️ FCM Token:', currentToken);
          // Save to Supabase
          await saveTokenToSupabase(currentToken);
          return true;
        } else {
          alert('⚠️ No registration token available.');
          return false;
        }

      } catch (err) {
        console.error('An error occurred while retrieving token/sw: ', err);
        alert('❌ Error Step 5 (Get Token): ' + err.message);
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
          alert('Failed to enable notifications. Please clear browser data for this site and try again.');
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
  const browserId = getBrowserId();
  const deviceInfo = navigator.userAgent;

  // Check if Supabase client is available (from window object)
  if (!window.supabaseClient) {
    console.error('❌ Supabase client not found!');
    return;
  }

  console.log('💾 Saving token to Supabase...', { browserId });

  const { error } = await window.supabaseClient
    .from('fcm_tokens')
    .upsert({ 
      browser_id: browserId, 
      fcm_token: token,
      device_info: deviceInfo,
      last_active: new Date().toISOString()
    }, { onConflict: 'browser_id' });

  if (error) {
    console.error('❌ Error saving token to Supabase:', error);
  } else {
    console.log('✅ Token saved to Supabase!');
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
  getBrowserId: getBrowserId
};
