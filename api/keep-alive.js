// Keeps the Supabase project from being paused for inactivity by running a
// tiny read against it. Triggered by the Vercel cron defined in vercel.json.

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://ohruaeodmwbvhrcvrzgy.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnVhZW9kbXdidmhyY3Zyemd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzY0MDAsImV4cCI6MjA4NTg1MjQwMH0.e9SE-3gE9qfWbde-QD5gWR0VLUKF7PDgKg-0I3Uk5ys';

// Tables are pinged in order until one answers, so a renamed table does not
// silently stop the keep-alive.
const TABLES = ['books', 'comments', 'reactions'];

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Vercel cron sends `Authorization: Bearer $CRON_SECRET` when the secret is
  // configured; without it the endpoint stays public (it only does a read).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const startedAt = Date.now();
  const failures = [];

  for (const table of TABLES) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        },
      );

      if (response.ok) {
        return res.status(200).json({
          ok: true,
          table,
          duration_ms: Date.now() - startedAt,
          checked_at: new Date().toISOString(),
        });
      }

      failures.push(`${table}: HTTP ${response.status}`);
    } catch (error) {
      failures.push(`${table}: ${error.message}`);
    }
  }

  console.error('Keep-alive ping failed:', failures.join('; '));
  return res.status(502).json({
    ok: false,
    error: 'Supabase unreachable',
    failures,
    duration_ms: Date.now() - startedAt,
  });
};
