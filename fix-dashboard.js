const fs = require('fs');
let c = fs.readFileSync('dashboard.js', 'utf8');

c = c.replace(
    /const coverImage = book\.cover_url \|\| book\.cover \|\| 'https:\/\/via\.placeholder\.com\/150x200\?text=No\+Cover';/g,
    `const title = window.escapeHTML ? window.escapeHTML(book.title) : book.title;
    const rawCover = book.cover_url || book.cover || 'https://via.placeholder.com/150x200?text=No+Cover';
    const coverImage = window.escapeHTML ? window.escapeHTML(rawCover) : rawCover;`
);

c = c.replace(/\$\{book\.title\}/g, '${title}');

fs.writeFileSync('dashboard.js', c);
console.log('Fixed dashboard.js');
