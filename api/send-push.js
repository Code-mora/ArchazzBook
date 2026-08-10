const admin = require('firebase-admin');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ohruaeodmwbvhrcvrzgy.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnVhZW9kbXdidmhyY3Zyemd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzY0MDAsImV4cCI6MjA4NTg1MjQwMH0.e9SE-3gE9qfWbde-QD5gWR0VLUKF7PDgKg-0I3Uk5ys';

// Mencegah inisialisasi ganda kalau function dipanggil berkali-kali
let initError = null;
if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
    }
    // Kita ambil kredensial dari Environment Variables Vercel
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    initError = error.message;
    console.error('Firebase admin initialization error:', error.message);
  }
}

// Only a signed-in Supabase user (the author/admin) may broadcast notifications.
async function getAuthenticatedUser(req) {
  const header = req.headers.authorization || '';
  const accessToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!accessToken) return null;

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user && user.id ? user : null;
  } catch (error) {
    console.error('Error verifying access token:', error.message);
    return null;
  }
}

function isSafeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized. Sign in as the author to send notifications.' });
  }

  // Jika inisialisasi gagal (karena belum setting Environment Variable)
  if (initError) {
    return res.status(500).json({ 
        success: false, 
        error: `Firebase Admin belum dikonfigurasi di Vercel: ${initError}`
    });
  }

  const { token, title, body, icon, url } = req.body || {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing FCM token' });
  }

  const message = {
    token: token,
    notification: {
      title: String(title || 'New Notification').slice(0, 200),
      body: String(body || '').slice(0, 1000),
    },
    webpush: {
      fcmOptions: {
        link: isSafeLink(url) ? url : '/' // Rekomendasi resmi Web Push untuk action klik
      },
      notification: {
        icon: isSafeLink(icon) ? icon : '/assets/images/logo-archazz.png'
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return res.status(200).json({ success: true, messageId: response });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
