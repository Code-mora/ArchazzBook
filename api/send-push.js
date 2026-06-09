const admin = require('firebase-admin');

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

module.exports = async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Jika inisialisasi gagal (karena belum setting Environment Variable)
  if (initError) {
    return res.status(500).json({ 
        success: false, 
        error: `Firebase Admin belum dikonfigurasi di Vercel: ${initError}`
    });
  }

  const { token, title, body, icon, url } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Missing FCM token' });
  }

  const message = {
    token: token,
    notification: {
      title: title || 'New Notification',
      body: body || '',
    },
    webpush: {
      fcmOptions: {
        link: url || '/' // Rekomendasi resmi Web Push untuk action klik
      },
      notification: {
        icon: icon || '/assets/images/logo-archazz.png'
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
