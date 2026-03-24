-- Menambahkan kolom chapter_id ke dalam tabel comments untuk mendukung fitur komentar per-bab (Webtoon style)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS chapter_id bigint;

-- Karena kolom ini ditambahkan belakangan, komentar lama yang tidak punya chapter_id akan otomatis bernilai NULL.
-- Pada aplikasi (reader.html), jika membaca buku format lama (bukan format bab), kolom ini tetap akan dikirimi null sehingga kompatibel.
