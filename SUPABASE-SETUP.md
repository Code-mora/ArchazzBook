# SUPABASE INTEGRATION GUIDE - ArchazzBook

## 📋 Setup Checklist

### ✅ Step 1: Get Your Supabase Credentials

1. Go to your Supabase dashboard
2. Click **Settings** (⚙️) in sidebar
3. Click **API**
4. Copy these two values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (the long string under "Project API keys")

### ✅ Step 2: Update Configuration File

1. Open `supabase-config.js`
2. Find these lines (near the top):
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
3. Replace with your actual values:
   ```javascript
   const SUPABASE_URL = 'https://ohruaeodmwbvhrcvrzgy.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Your actual key
   ```

### ✅ Step 3: Add Supabase Client Library

Add this script tag to ALL your HTML files (index.html, dashboard.html, writer.html, reader.html):

**Add BEFORE your existing `<script>` tags:**

```html
<!-- Supabase Client Library -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Supabase Config -->
<script src="supabase-config.js"></script>
```

### ✅ Step 4: Update HTML Files

#### index.html
Add supabase scripts before `</body>`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
<script src="app.js"></script>
```

#### dashboard.html
Add supabase scripts before `</body>`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
<script src="app.js"></script>
<script src="dashboard.js"></script>
```

#### writer.html
Add supabase scripts in the correct order

#### reader.html
Add supabase scripts in the correct order

---

## 🔄 Migration Process

### What Changed:

1. **localStorage → Supabase Database**
   - Books are now stored in cloud database
   - Accessible from any device

2. **Base64 images → Supabase Storage**
   - Cover images stored in Supabase Storage
   - Much better performance
   - No localStorage size limits

3. **Multi-device sync**
   - Write on mobile → See on laptop
   - Real-time sync!

### Backward Compatibility:

The code will:
1. Check Supabase first
2. Fallback to localStorage if Supabase fails
3. You can migrate existing localStorage data later

---

## 🧪 Testing

### Test 1: Create a Book
1. Login to dashboard
2. Create a new book
3. Check Supabase dashboard → Table Editor → books table
4. Should see your book there!

### Test 2: Multi-Device Sync
1. Open dashboard on one device/browser
2. Create a book
3. Open index.html on another device/browser
4. Should see the same book!

### Test 3: Cover Upload
1. Create book with cover image
2. Check Supabase dashboard → Storage → book-covers
3. Should see your cover image there!

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch books"
- ✅ Check Supabase URL and key are correct
- ✅ Check browser console for errors
- ✅ Verify internet connection

### Issue: "Cannot upload cover"
- ✅ Check bucket `book-covers` exists
- ✅ Check bucket is set to PUBLIC
- ✅ Check storage policies allow uploads

### Issue: Books not showing
- ✅ Check RLS policies in Supabase
- ✅ Check browser console for errors
- ✅ Try refreshing the page

---

## 📊 Database Schema

### books table:
- `id` (BIGSERIAL) - Auto-generated ID
- `title` (TEXT) - Book title
- `author_name` (TEXT) - Author name
- `cover_url` (TEXT) - URL to cover image
- `preview` (TEXT) - Book preview/description
- `story` (TEXT) - Full story content
- `genre` (TEXT) - Book genre
- `pages` (INTEGER) - Number of pages
- `views` (INTEGER) - View count
- `created_at` (TIMESTAMP) - Creation date
- `updated_at` (TIMESTAMP) - Last update date

---

## 🔐 Security Notes

### Public API Key:
- The `anon` key is safe to use in browser
- It has limited permissions (defined by RLS policies)
- Never share your `service_role` key!

### RLS Policies:
- Anyone can READ books (public reading)
- Anyone can CREATE/UPDATE/DELETE books (you're solo author)
- If you want stricter security, we can add API key check

---

## 🚀 Next Steps

After basic integration works:
1. ✅ Migrate existing localStorage data to Supabase
2. ✅ Add real-time subscriptions (live updates)
3. ✅ Add book analytics
4. ✅ Add search and filtering
5. ✅ Add pagination for large book lists

---

**Questions? Check the browser console for detailed logs!**
