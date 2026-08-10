const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load-script');
const { toPlain } = require('./helpers/fake-dom');

function loadDashboard(options = {}) {
  return loadScript('dashboard.js', { bindings: ['uploadedCover', 'quillEditor'], ...options });
}

test('storage helpers round-trip books and tolerate corrupt data', () => {
  const env = loadDashboard();

  assert.equal(env.saveBooksToStorage([{ id: 1 }]), true);
  assert.deepEqual(toPlain(env.getBooksFromStorage()), [{ id: 1 }]);

  env.localStorage.setItem('books', '{oops');
  assert.deepEqual(toPlain(env.getBooksFromStorage()), []);
});

test('loadDashboardBooks renders a desktop row per book with a status badge', async () => {
  const env = loadDashboard();
  env.window.SupabaseAPI = {
    fetchBooks: async () => [
      { id: 1, title: 'Live', pages: 10, created_at: '2024-02-03T00:00:00.000Z' },
      { id: 2, title: 'WIP', pages: 2, status: 'draft', created_at: '2024-02-04T00:00:00.000Z' },
    ],
  };

  await env.loadDashboardBooks();

  const tbody = env.document.getElementById('books-table-body');
  assert.equal(tbody.children.length, 2);
  assert.equal(tbody.children[0].tagName, 'TR');
  assert.ok(tbody.children[0].innerHTML.includes('PUBLISHED'));
  assert.ok(tbody.children[0].innerHTML.includes('Feb 3, 2024'));
  assert.ok(tbody.children[1].innerHTML.includes('DRAFT'));
  assert.ok(tbody.children[1].innerHTML.includes("writer.html?id=2"));
});

test('loadDashboardBooks renders mobile cards below the breakpoint', async () => {
  const env = loadDashboard();
  env.window.innerWidth = 480;
  env.window.SupabaseAPI = {
    fetchBooks: async () => [{ id: 1, title: 'Mobile', pages: 3, date: '2024-02-03' }],
  };

  await env.loadDashboardBooks();

  const tbody = env.document.getElementById('books-table-body');
  assert.equal(tbody.children[0].className, 'book-mobile-card');
});

test('loadDashboardBooks escapes book titles when the helper is available', async () => {
  const env = loadDashboard();
  env.window.escapeHTML = (value) => String(value).replace(/</g, '&lt;');
  env.window.SupabaseAPI = {
    fetchBooks: async () => [{ id: 1, title: '<img onerror=alert(1)>', pages: 1 }],
  };

  await env.loadDashboardBooks();

  const html = env.document.getElementById('books-table-body').children[0].innerHTML;
  assert.ok(!html.includes('<img onerror'), 'title escaped');
  assert.ok(html.includes('&lt;img onerror=alert(1)>'));
});

test('loadDashboardBooks shows the empty state and falls back to localStorage', async () => {
  const empty = loadDashboard();
  await empty.loadDashboardBooks();
  assert.ok(empty.document.getElementById('books-table-body').innerHTML.includes('No books yet'));

  const offline = loadDashboard();
  offline.localStorage.setItem('books', JSON.stringify([{ id: 3, title: 'Cached', pages: 1 }]));
  offline.window.SupabaseAPI = {
    fetchBooks: async () => {
      throw new Error('offline');
    },
  };
  await offline.loadDashboardBooks();
  assert.ok(
    offline.document.getElementById('books-table-body').children[0].innerHTML.includes('Cached'),
  );
});

test('deleteBook removes the book from Supabase and localStorage', async () => {
  const env = loadDashboard();
  env.localStorage.setItem('books', JSON.stringify([{ id: 1 }, { id: 2 }]));
  const deleted = [];
  env.window.SupabaseAPI = {
    deleteBook: async (id) => deleted.push(id),
    fetchBooks: async () => [],
  };

  await env.deleteBook(1);

  assert.deepEqual(toPlain(deleted), [1]);
  assert.deepEqual(toPlain(JSON.parse(env.localStorage.getItem('books'))), [{ id: 2 }]);
});

test('deleteBook aborts when the confirmation is declined', async () => {
  const env = loadDashboard();
  env.localStorage.setItem('books', JSON.stringify([{ id: 1 }]));
  env.window.confirmResponses.push(false);

  await env.deleteBook(1);

  assert.deepEqual(toPlain(JSON.parse(env.localStorage.getItem('books'))), [{ id: 1 }]);
});

test('deleteBook surfaces a notification when Supabase fails', async () => {
  const env = loadDashboard();
  env.window.SupabaseAPI = {
    deleteBook: async () => {
      throw new Error('permission denied');
    },
  };

  await env.deleteBook(1);

  assert.ok(
    env.document.body.children.some(
      (c) => c.textContent === 'Failed to delete book. Please try again.',
    ),
  );
});

test('handleBookSubmit requires a cover before publishing', () => {
  const env = loadDashboard();

  env.handleBookSubmit({ preventDefault() {} });

  assert.deepEqual(toPlain(env.window.alerts), ['Please upload a cover image']);
  assert.equal(env.localStorage.getItem('books'), null);
});

test('handleBookSubmit stores the new book and resets the form', () => {
  const env = loadDashboard();
  env.bindings.uploadedCover = 'data:image/png;base64,abc';
  env.document.addElement('book-title', 'input').value = 'Fresh Story';
  env.document.addElement('book-preview', 'textarea').value = 'A preview';
  env.document.addElement('book-story', 'textarea').value = '<p>Body</p>';
  env.document.addElement('book-pages', 'input').value = '12';
  const form = env.document.addElement('book-form', 'form');

  env.handleBookSubmit({ preventDefault() {} });

  const [saved] = JSON.parse(env.localStorage.getItem('books'));
  assert.equal(saved.title, 'Fresh Story');
  assert.equal(saved.preview, 'A preview');
  assert.equal(saved.pages, 12);
  assert.equal(saved.cover, 'data:image/png;base64,abc');
  assert.equal(saved.author, 'Archazz');
  assert.equal(form.wasReset, true);
  assert.equal(env.bindings.uploadedCover, null);
});

test('editBook loads the book into the form and removes the original entry', () => {
  const env = loadDashboard();
  env.localStorage.setItem(
    'books',
    JSON.stringify([
      { id: 1, title: 'Editable', preview: 'p', pages: 5, story: '<p>s</p>', cover: 'c.png' },
      { id: 2, title: 'Other' },
    ]),
  );

  env.editBook(1);

  assert.equal(env.document.getElementById('book-title').value, 'Editable');
  assert.equal(env.document.getElementById('book-pages').value, 5);
  assert.equal(env.document.getElementById('preview-img').src, 'c.png');
  assert.equal(env.bindings.uploadedCover, 'c.png');
  assert.deepEqual(
    toPlain(JSON.parse(env.localStorage.getItem('books')).map((b) => b.id)),
    [2],
  );
});

test('editBook ignores unknown ids', () => {
  const env = loadDashboard();
  env.localStorage.setItem('books', JSON.stringify([{ id: 1 }]));

  env.editBook(404);

  assert.deepEqual(toPlain(JSON.parse(env.localStorage.getItem('books'))), [{ id: 1 }]);
});

test('toggleUploadForm shows then hides and resets the upload section', () => {
  const env = loadDashboard();
  const section = env.document.addElement('upload-section');
  section.style.display = 'none';

  env.toggleUploadForm();
  assert.equal(section.style.display, 'block');

  env.bindings.uploadedCover = 'cover';
  env.toggleUploadForm();
  assert.equal(section.style.display, 'none');
  assert.equal(env.bindings.uploadedCover, null);
  assert.equal(env.document.getElementById('cover-upload').classList.contains('has-file'), false);
});

test('updateStats reports the book count and derives views', async () => {
  const env = loadDashboard();
  env.window.SupabaseAPI = { fetchBooks: async () => [{ id: 1 }, { id: 2 }] };

  await env.updateStats();

  assert.equal(env.document.getElementById('total-books').textContent, '2');
  const views = JSON.parse(env.localStorage.getItem('booksViews'));
  assert.deepEqual(toPlain(Object.keys(views)), ['1', '2']);
  const total = Object.values(views).reduce((sum, value) => sum + value, 0);
  assert.equal(env.document.getElementById('total-views').textContent, total.toLocaleString());
});

test('updateStats reuses previously generated view counts', async () => {
  const env = loadDashboard();
  env.window.SupabaseAPI = { fetchBooks: async () => [{ id: 1 }] };
  env.localStorage.setItem('booksViews', JSON.stringify({ 1: 100, 2: 50 }));

  await env.updateStats();

  assert.equal(env.document.getElementById('total-views').textContent, '150');
});

test('checkDashboardAuth redirects visitors without a session', async () => {
  const env = loadDashboard();
  env.window.SupabaseAPI = { getSession: async () => null };

  await env.checkDashboardAuth();

  assert.equal(env.window.location.href, 'index.html');
});

test('checkDashboardAuth greets the author on a valid session', async () => {
  const env = loadDashboard();
  env.window.SupabaseAPI = { getSession: async () => ({ user: { email: 'a@b.c' } }) };

  await env.checkDashboardAuth();

  assert.equal(env.document.getElementById('user-name').textContent, 'Archazz');
});

test('logout clears the session only after confirmation', async () => {
  const env = loadDashboard();
  let signedOut = false;
  env.window.SupabaseAPI = { signOut: async () => { signedOut = true; } };
  env.localStorage.setItem('currentUser', 'x');

  env.window.confirmResponses.push(false);
  await env.logout();
  assert.equal(signedOut, false);

  env.window.confirmResponses.push(true);
  await env.logout();
  assert.equal(signedOut, true);
  assert.equal(env.localStorage.getItem('currentUser'), null);
  assert.equal(env.window.location.href, 'index.html');
});

test('toggleMobileMenu swaps the burger icon', () => {
  const env = loadDashboard();
  const navLinks = env.document.addElement('nav-links');
  const icon = env.document.createElement('i');
  icon.className = 'fa-bars';
  const button = env.document.createElement('button');
  button.className = 'mobile-menu-btn';
  button.appendChild(icon);
  env.document.body.appendChild(button);
  // querySelector('.mobile-menu-btn i') is simplified to the icon element.
  env.document.querySelector = (selector) => (selector.includes('mobile-menu-btn') ? icon : null);

  env.toggleMobileMenu();
  assert.equal(navLinks.classList.contains('active'), true);
  assert.equal(icon.classList.contains('fa-times'), true);

  env.toggleMobileMenu();
  assert.equal(navLinks.classList.contains('active'), false);
  assert.equal(icon.classList.contains('fa-bars'), true);
});

test('formatDate renders a short US date', () => {
  const env = loadDashboard();
  assert.equal(env.formatDate('2024-12-25T00:00:00.000Z'), 'Dec 25, 2024');
});
