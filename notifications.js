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
    try {
      // Try modern crypto API first
      if (crypto && crypto.randomUUID) {
        bid = crypto.randomUUID();
      } else {
        // Fallback for older browsers
        bid = generateUUIDFallback();
      }
      localStorage.setItem('archazz_browser_id', bid);
    } catch (e) {
      console.error('Error generating UUID:', e);
      // Last resort: timestamp-based ID
      bid = 'fallback-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('archazz_browser_id', bid);
    }
  }
  return bid;
}

// UUID v4 Polyfill for older browsers
function generateUUIDFallback() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
    
    // Check if browser supports notifications (iOS/mobile check)
    if (!('Notification' in window)) {
        throw new Error('NOT_SUPPORTED');
    }
    
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

        // Wait for SW to actually activate before getting token
        const waitForActive = async (reg) => {
            if (reg.active) return reg;
            return new Promise((resolve) => {
                const worker = reg.installing || reg.waiting;
                if (!worker) {
                    // Fallback
                    setTimeout(() => resolve(reg), 2000);
                    return;
                }
                worker.addEventListener('statechange', (e) => {
                    if (e.target.state === 'activated') {
                        resolve(reg);
                    }
                });
            });
        };

        const registration = await waitForActive(swReg);
        await navigator.serviceWorker.ready;

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
          await new Promise(resolve => setTimeout(resolve, 1000));
          const freshReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
          await navigator.serviceWorker.ready;
          // Adding a short breather for SW to catch up
          await new Promise(resolve => setTimeout(resolve, 1500));
          
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
    throw err;
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
// Wait for DOM and Supabase to be ready
function initNotificationUI() {
    console.log('📜 Notifications Script Loaded. Looking for buttons...');
    const btnAllow = document.getElementById('btn-allow');
    const btnDismiss = document.getElementById('btn-dismiss');
    const banner = document.getElementById('notification-banner');

    // Check if Supabase is ready (it should be loaded before this module)
    if (!window.supabaseClient) {
        console.warn('⚠️ Supabase not ready yet, retrying in 100ms...');
        setTimeout(initNotificationUI, 100);
        return;
    }
    
    console.log('✅ Supabase client ready!');

    if (btnAllow) {
        console.log('✅ Found Allow Button. Attaching listener...');
        btnAllow.addEventListener('click', async () => {
            // Disable button and show loading state
            btnAllow.disabled = true;
            const originalText = btnAllow.innerHTML;
            btnAllow.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Setting up...';
            
            // VAPID Key provided by user (Updated)
            const vapidKey = 'BFkoF2BLu0eulaqu3HxgJVFMJ-hHYFPSfMGvt0Lr1PzFag39n0K6YSOQ0LHTaLg0CHHNHoJXEbXrk1j1OgSiHfI'; 
            
            try {
                const success = await setupNotifications(vapidKey);
                if (success) {
                    // Success - hide banner with animation and mark as granted
                    if (banner) {
                        banner.classList.add('hiding');
                        setTimeout(() => banner.style.display = 'none', 300);
                    }
                    localStorage.setItem('archazz_notif_status', 'granted');
                    alert('✅ Notifications enabled! You will now receive updates.');
                } else {
                    // Failed but no error thrown (e.g., user denied permission)
                    if (banner) {
                        banner.classList.add('hiding');
                        setTimeout(() => banner.style.display = 'none', 300);
                    }
                    localStorage.setItem('archazz_notif_status', 'denied');
                    alert('❌ Izin notifikasi ditolak oleh browser.\n\nCara memperbaiki:\n1. Klik ikon "Gembok" (Lock) atau "Tune/Settings" di sebelah kiri alamat web ini (URL bar)\n2. Cari menu "Notifications" / "Notifikasi"\n3. Ubah pengaturannya jadi "Allow" / "Izinkan"\n4. Refresh halamannya!');
                }
            } catch (err) {
                console.error('Setup failed:', err);
                // Restore button state on error so user can retry
                btnAllow.disabled = false;
                btnAllow.innerHTML = originalText;
                if (err.message && err.message.includes('PushManager')) {
                    alert('⚠️ Gagal mendapatkan akses notifikasi.\n\nJika kamu menggunakan BRAVE BROWSER:\n1. Buka menu Brave ☰ -> Settings\n2. Cari "Privacy and security"\n3. Nyalakan opsi "Use Google services for push messaging"\n4. Refresh halaman ini dan coba lagi.');
                } else if (err.message && (err.message.includes('NOT_SUPPORTED') || err.message.includes('is not defined'))) {
                    alert('⚠️ Yahh, sayangnya browser di HP kamu ini belum mendukung fitur Push Notification (biasanya karena limitasi di iPhone/iOS atau browser versi lama).\n\nTapi tenang, kamu tetap bisa baca ceritanya dengan normal kok! 😊');
                    // Hide the banner permanently for this device so it doesn't annoy them
                    if (banner) {
                        banner.style.display = 'none';
                    }
                    localStorage.setItem('archazz_notif_status', 'unsupported');
                } else {
                    alert('⚠️ Setup failed: ' + err.message + '. Please try again.');
                }
            }
        });
    } else {
        console.log('⚠️ Allow Button NOT found (yet).');
    }

    if (btnDismiss) {
        btnDismiss.addEventListener('click', () => {
            if (banner) {
                banner.classList.add('hiding');
                setTimeout(() => banner.style.display = 'none', 300);
            }
            localStorage.setItem('archazz_notif_status', 'dismissed');
        });
    }

    // Show banner logic - improved to handle edge cases
    const notifStatus = localStorage.getItem('archazz_notif_status');
    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

    // Show banner if:
    // 1. User hasn't made a choice yet (no status in localStorage)
    // 2. OR user previously dismissed but permission is still default (give another chance)
    const shouldShow = (!notifStatus || (notifStatus === 'dismissed' && permission === 'default')) 
                       && permission !== 'granted' 
                       && permission !== 'denied'
                       && banner;

    if (shouldShow) {
        setTimeout(() => {
            banner.style.display = 'flex';
        }, 3000); 
    }
} // End initNotificationUI

// Start initialization
initNotificationUI();
