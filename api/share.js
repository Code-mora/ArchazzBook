const DEFAULT_IMAGE =
    'https://raw.githubusercontent.com/Code-mora/ArchazzBook/main/assets/about-illustration.jpg';
const SITE_ORIGIN = 'https://archazzbook.vercel.app';

// Public (anon) Supabase credentials. Read-only access is enforced by RLS.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ohruaeodmwbvhrcvrzgy.supabase.co';
// The anon key is public by design (it is also shipped in the browser bundle) and only
// grants what RLS allows, but prefer the environment value when it is configured.
const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnVhZW9kbXdidmhyY3Zyemd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzY0MDAsImV4cCI6MjA4NTg1MjQwMH0.e9SE-3gE9qfWbde-QD5gWR0VLUKF7PDgKg-0I3Uk5ys';

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            default: return '&#39;';
        }
    });
}

// Only positive integers are valid book/chapter identifiers
function parseId(value) {
    if (typeof value !== 'string' || !/^\d{1,19}$/.test(value)) return null;
    return value;
}

// Reject javascript:/data: and other non-http(s) URLs before putting them in meta tags
function safeImageUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : DEFAULT_IMAGE;
    } catch (e) {
        return DEFAULT_IMAGE;
    }
}

module.exports = async (req, res) => {
    const id = parseId(req.query.id);
    const chapterId = parseId(req.query.chapter_id);

    let title = 'Read on ArchazzBook';
    let description = 'Discover and read captivating digital stories on ArchazzBook.';
    let image = DEFAULT_IMAGE;

    if (id && SUPABASE_ANON_KEY) {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/books?id=eq.${id}&select=title,cover_url,preview`,
                {
                    headers: {
                        apikey: SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                }
            );

            if (response.ok) {
                const books = await response.json();
                if (books && books.length > 0) {
                    const book = books[0];
                    title = `${book.title} - ArchazzBook`;
                    if (book.preview) description = book.preview;
                    if (book.cover_url) image = safeImageUrl(book.cover_url);
                }
            }
        } catch (error) {
            console.error('Error fetching book for share preview:', error);
        }
    }

    const readerPath = `/reader.html${id ? `?id=${id}` : ''}${
        id && chapterId ? `&chapter_id=${chapterId}` : ''
    }`;

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeImage = escapeHtml(image);
    const safeCanonical = escapeHtml(`${SITE_ORIGIN}${readerPath}`);
    // readerPath only contains validated numeric ids, so it is safe to inline as a JS literal
    const safeRedirect = JSON.stringify(readerPath);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:image" content="${safeImage}">
    <meta property="og:url" content="${safeCanonical}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${safeImage}">

    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f8fafc; color: #475569; }
        .loader { text-align: center; }
        .spinner { border: 4px solid #e2e8f0; border-top: 4px solid #6366f1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 16px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="loader">
        <div class="spinner"></div>
        <p>Redirecting to story...</p>
    </div>
    <script>
        // Immediately redirect the real user to the reader page
        window.location.replace(${safeRedirect});
    </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).send(html);
};
