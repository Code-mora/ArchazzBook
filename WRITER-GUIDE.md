# ArchazzBook - Novel Writing & Reading Platform

## Fitur Baru yang Ditambahkan

### 1. **Writer Interface (writer.html)**
Editor profesional dengan tampilan A4 seperti kertas asli untuk menulis novel:

#### Fitur Utama:
- ✍️ **Editor A4 Format**: Setiap halaman ditampilkan dalam format A4 (21cm x 29.7cm) seperti kertas asli
- 📚 **Multi-Chapter Support**: Buat dan kelola multiple chapter/episode dalam satu buku
- 📄 **Multi-Page System**: Setiap chapter bisa punya multiple pages
- 🔢 **Auto Page Detection**: Sistem otomatis mendeteksi ketika halaman sudah penuh (>500 kata) dan memberi notifikasi
- 📊 **Real-time Statistics**: 
  - Total kata di seluruh buku
  - Total halaman
  - Total chapter
- 🎨 **Rich Text Formatting**: 
  - Multiple fonts (Times New Roman, Arial, Georgia, Courier, Verdana)
  - Bold, Italic, Underline
  - Headers (H1-H6)
  - Colors, alignment, lists, quotes
- 💾 **Auto-save**: Konten otomatis tersimpan saat mengetik
- 👁️ **Live Preview**: Preview buku sebelum publish
- 📑 **Chapter Management**:
  - Add, edit, delete chapter
  - Navigate between chapters
  - Rename chapter titles
- 🖼️ **Cover Upload**: Upload cover image untuk buku

### 2. **Enhanced Reader (reader.html)**
Pembaca yang sudah di-upgrade untuk support chapter navigation:

#### Fitur:
- 📖 **Chapter Selector**: Dropdown untuk memilih chapter yang ingin dibaca
- ⏩ **Auto Chapter Navigation**: Otomatis ke chapter berikutnya saat mencapai akhir chapter
- 📊 **Global Progress Bar**: Progress bar yang menghitung seluruh chapter
- ⌨️ **Keyboard Navigation**: 
  - Arrow Left: Previous page/chapter
  - Arrow Right: Next page/chapter
- 🔄 **Backward Compatibility**: Tetap support buku format lama

### 3. **Updated Dashboard**
Dashboard sekarang punya:
- 🆕 **"Write New Book"** button - buka writer interface
- 📝 **Edit Button** - edit buku yang sudah ada di writer interface
- 📤 **"Quick Upload"** - metode lama untuk compatibility

## Cara Menggunakan

### Menulis Buku Baru:
1. Login sebagai author (gunakan kredensial Supabase Auth kamu)
2. Klik **"Dashboard"**
3. Klik **"Write New Book"**
4. Masukkan judul buku
5. Mulai menulis di halaman pertama
6. Gunakan toolbar untuk formatting (bold, italic, font, dll)
7. Ketika halaman penuh (>500 kata), akan muncul notifikasi - klik untuk add page baru
8. Untuk menambah chapter baru, klik **"New Chapter"**
9. Upload cover image (opsional) melalui **"Upload Cover"**
10. Klik **"Save & Publish"** untuk menyimpan

### Membaca Buku:
1. Pilih buku dari home page
2. Klik **"Read Now"**
3. Jika buku punya multiple chapters, pilih chapter dari dropdown
4. Navigate dengan tombol Previous/Next atau keyboard arrows
5. Customize dengan:
   - Font size (+/-)
   - Dark mode toggle
   - Reading settings di sidebar

## Data Structure

### Format Buku Baru (Chapter-based):
```javascript
{
  id: timestamp,
  title: "Judul Buku",
  author: "Nama Author",
  cover: "base64_image_data",
  date: "YYYY-MM-DD",
  pages: total_halaman, // untuk compatibility
  preview: "Preview text...",
  chapters: [
    {
      id: chapter_id,
      title: "Chapter 1",
      pages: [
        {
          id: page_id,
          content: "<p>HTML content...</p>"
        }
      ]
    }
  ]
}
```

### Format Lama (Legacy - masih didukung):
```javascript
{
  id: timestamp,
  title: "Judul Buku",
  author: "Nama Author",
  cover: "base64_image_data",
  story: "<html content>",
  pages: number,
  date: "YYYY-MM-DD",
  preview: "Preview..."
}
```

## Teknologi yang Digunakan

- **Quill.js**: Rich text editor
- **LocalStorage**: Data persistence
- **Vanilla JavaScript**: No framework dependencies
- **CSS Grid & Flexbox**: Responsive layouts
- **Font Awesome**: Icons
- **Google Fonts**: Typography (Outfit, Playfair Display)

## Keyboard Shortcuts

### Writer:
- `Ctrl/Cmd + S`: Save & Publish

### Reader:
- `Arrow Left`: Previous page/chapter
- `Arrow Right`: Next page/chapter
- `Esc`: Close modals

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Tips & Best Practices

1. **Menulis**:
   - Gunakan font Times New Roman untuk novel profesional
   - Break cerita menjadi chapter yang logis (5-10 halaman per chapter)
   - Usahakan setiap halaman 400-600 kata untuk pembacaan yang nyaman
   - Save secara berkala (atau gunakan Ctrl+S)

2. **Struktur Chapter**:
   - Chapter 1-5: Setup & Introduction
   - Chapter 6-15: Rising Action
   - Chapter 16-20: Climax
   - Chapter 21-25: Resolution

3. **Cover Image**:
   - Recommended size: 600x800px atau 400x600px
   - Format: JPG atau PNG
   - File size: < 5MB

## Troubleshooting

**Q: Editor tidak muncul?**
A: Pastikan JavaScript enabled dan internet connection stabil (untuk load Quill.js dari CDN)

**Q: Buku lama tidak bisa dibaca?**
A: Reader sudah support backward compatibility, buku lama tetap bisa dibaca dengan format legacy

**Q: Kehilangan data?**
A: Data disimpan di browser localStorage. Jangan clear browser data atau gunakan private/incognito mode

**Q: Cover tidak ter-upload?**
A: Pastikan file < 5MB dan format JPG/PNG

## Future Enhancements

Rencana pengembangan:
- [ ] Export to PDF/EPUB
- [ ] Cloud sync dengan backend
- [ ] Collaboration features
- [ ] Comments system
- [ ] Reading bookmarks
- [ ] Reading history & analytics
- [ ] Mobile app
- [ ] Social sharing
- [ ] Book categories & tags
- [ ] Search functionality

---

**Developed by Archazz**
© 2026 ArchazzBook - All Rights Reserved
