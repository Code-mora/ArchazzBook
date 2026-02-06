const admin = require('firebase-admin');

// Mencegah inisialisasi ganda kalau function dipanggil berkali-kali
if (!admin.apps.length) {
  try {
    // Kita ambil kredensial dari Environment Variables Vercel
    // Tips: Di Vercel nanti, paste isi service-account.json ke variabel bernama FIREBASE_SERVICE_ACCOUNT
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
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
      notification: {
        icon: icon || '/assets/icon.png',
        click_action: url || '/' // URL yang dibuka saat diklik
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
