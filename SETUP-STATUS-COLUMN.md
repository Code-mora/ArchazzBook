# 🛠️ Database Update Required (PENTING!)

Untuk mengaktifkan fitur **Save Draft vs Publish**, kamu perlu menambahkan kolom baru di Supabase.

### **Instruksi SQL:**

1. Buka **Supabase Dashboard**.
2. Klik icon **SQL Editor** (di sidebar kiri).
3. Klik **+ New Query**.
4. **Copy & Paste** kode berikut:

```sql
-- Tambahkan kolom status draft/published
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Update semua buku lama jadi 'published' agar tetap muncul
UPDATE books 
SET status = 'published' 
WHERE status IS NULL;
```

5. Klik **Run** (tombol hijau di kanan bawah).

---

### **Apa yang terjadi?**
- Semua buku baru akan punya status `draft` atau `published`.
- Buku lama akan otomatis di-set ke `published` supaya tidak hilang dari halaman depan.
