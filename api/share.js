module.exports = async (req, res) => {
    const { id } = req.query;
    
    // Default fallback values
    let title = 'Read on ArchazzBook';
    let description = 'Discover and read captivating digital stories on ArchazzBook.';
    let image = 'https://raw.githubusercontent.com/Code-mora/ArchazzBook/main/assets/about-illustration.jpg';
    
    // Supabase Credentials (public anon key is safe here for read-only access)
    const SUPABASE_URL = 'https://ohruaeodmwbvhrcvrzgy.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnVhZW9kbXdidmhyY3Zyemd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzY0MDAsImV4cCI6MjA4NTg1MjQwMH0.e9SE-3gE9qfWbde-QD5gWR0VLUKF7PDgKg-0I3Uk5ys';

    if (id) {
        try {
            // Fetch book details from Supabase via REST API
            const response = await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${id}&select=title,cover_url,preview,chapters`, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            
            if (response.ok) {
                const books = await response.json();
                if (books && books.length > 0) {
                    const book = books[0];
                    title = `${book.title} - ArchazzBook`;
                    if (book.preview) {
                        description = book.preview;
                    }
                    if (book.cover_url) {
                        image = book.cover_url;
                    }
                    
                    // Note: If we passed chapter_id, we could potentially extract chapter title from `book.chapters` JSONB array here.
                }
            }
        } catch (error) {
            console.error('Error fetching book for share preview:', error);
        }
    }

    // HTML Template with Open Graph Tags and a JavaScript Redirect
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="https://archazzbook.vercel.app/reader.html?id=${id || ''}">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
    <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}">
    <meta name="twitter:image" content="${image}">

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
        window.location.replace("/reader.html${id ? '?id=' + id : ''}");
    </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).send(html);
};
