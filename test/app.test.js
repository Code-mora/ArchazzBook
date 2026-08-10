const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load-script');
const { toPlain } = require('./helpers/fake-dom');

function loadApp(options = {}) {
  return loadScript('app.js', { bindings: ['currentUser'], ...options });
}

test('escapeHTML escapes every HTML-significant character', () => {
  const env = loadApp();

  assert.equal(
    env.escapeHTML(`<img src="x" onerror='alert(1)'> & done`),
    '&lt;img src=&quot;x&quot; onerror=&#039;alert(1)&#039;&gt; &amp; done',
  );
  assert.equal(env.escapeHTML(0), '');
  assert.equal(env.escapeHTML(undefined), '');
  assert.equal(env.escapeHTML(42), '42');
  assert.equal(env.window.escapeHTML, env.escapeHTML, 'exported on window');
});

test('formatDate renders a short US date', () => {
  const env = loadApp();
  assert.equal(env.formatDate('2024-03-07T10:00:00.000Z'), 'Mar 7, 2024');
});

test('getBooksFromStorage returns parsed books, or [] when absent or corrupt', () => {
  const env = loadApp();

  assert.deepEqual(toPlain(env.getBooksFromStorage()), []);

  env.localStorage.setItem('books', JSON.stringify([{ id: 1, title: 'A' }]));
  assert.deepEqual(toPlain(env.getBooksFromStorage()), [{ id: 1, title: 'A' }]);

  env.localStorage.setItem('books', 'not-json');
  assert.deepEqual(toPlain(env.getBooksFromStorage()), []);
  assert.equal(env.logs.error.length, 1);
});

test('saveBooksToStorage persists books and reports failure', () => {
  const env = loadApp();

  assert.equal(env.saveBooksToStorage([{ id: 1 }]), true);
  assert.deepEqual(JSON.parse(env.localStorage.getItem('books')), [{ id: 1 }]);

  env.localStorage.setItem = () => {
    throw new Error('quota exceeded');
  };
  assert.equal(env.saveBooksToStorage([{ id: 2 }]), false);
});

test('createBookCard renders Supabase and legacy book shapes safely', () => {
  const env = loadApp();

  const card = env.createBookCard({
    id: 7,
    title: '<script>alert(1)</script>',
    cover_url: 'https://cdn.test/cover.png',
    genre: 'Fantasy',
    preview: 'A "quoted" preview',
    pages: 120,
    created_at: '2024-01-02T00:00:00.000Z',
  });

  assert.equal(card.className, 'book-card');
  assert.equal(card.dataset.genre, 'fantasy');
  assert.ok(!card.innerHTML.includes('<script>'), 'title is escaped');
  assert.ok(card.innerHTML.includes('&lt;script&gt;'));
  assert.ok(card.innerHTML.includes('A &quot;quoted&quot; preview'));
  assert.ok(card.innerHTML.includes('https://cdn.test/cover.png'));
  assert.ok(card.innerHTML.includes('Jan 2, 2024'));

  const legacy = env.createBookCard({
    id: 8,
    title: 'Legacy',
    author: 'Someone',
    cover: 'legacy.png',
    date: '2023-05-05T00:00:00.000Z',
  });
  assert.equal(legacy.dataset.genre, 'other');
  assert.ok(legacy.innerHTML.includes('by Someone'));
  assert.ok(legacy.innerHTML.includes('General'), 'falls back to General genre');
  assert.ok(legacy.innerHTML.includes('legacy.png'));
});

test('filterBooks shows matching cards and toggles the empty-results message', () => {
  // autoCreate is off so the "no results" element genuinely starts missing.
  const env = loadApp({ autoCreate: false });
  const { document } = env;

  const grid = document.addElement('books-grid');
  const search = document.addElement('book-search', 'input');
  const genre = document.addElement('genre-select', 'select');

  const makeCard = (title, bookGenre) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.dataset.title = title;
    card.dataset.genre = bookGenre;
    grid.appendChild(card);
    return card;
  };

  const fantasy = makeCard('dragon rider', 'fantasy');
  const romance = makeCard('summer love', 'romance');

  search.value = 'dragon';
  genre.value = 'all';
  env.filterBooks();
  assert.equal(fantasy.style.display, 'block');
  assert.equal(romance.style.display, 'none');

  search.value = '';
  genre.value = 'romance';
  env.filterBooks();
  assert.equal(fantasy.style.display, 'none');
  assert.equal(romance.style.display, 'block');

  search.value = 'nothing matches';
  genre.value = 'all';
  env.filterBooks();
  const noResults = grid.children.find((c) => c.id === 'no-results-message');
  assert.ok(noResults, 'no-results message added');
  assert.ok(noResults.innerHTML.includes('No Books Found'));

  search.value = 'dragon';
  env.filterBooks();
  assert.equal(noResults.removed, true, 'no-results message removed again');
});

test('loadBooks renders published Supabase books and skips drafts', async () => {
  const env = loadApp();
  const grid = env.document.addElement('books-grid');

  env.window.SupabaseAPI = {
    fetchBooks: async () => [
      { id: 1, title: 'Published', status: 'published' },
      { id: 2, title: 'Draft', status: 'draft' },
      { id: 3, title: 'Legacy' },
    ],
    countHappyReaders: async () => 12,
  };

  await env.loadBooks();

  assert.equal(grid.children.length, 2);
  assert.ok(grid.children[0].innerHTML.includes('Published'));
  assert.ok(grid.children[1].innerHTML.includes('Legacy'));
  assert.equal(env.document.getElementById('books-count').textContent, '2');
});

test('loadBooks falls back to localStorage when Supabase fails', async () => {
  const env = loadApp();
  const grid = env.document.addElement('books-grid');
  env.localStorage.setItem('books', JSON.stringify([{ id: 9, title: 'Offline' }]));

  env.window.SupabaseAPI = {
    fetchBooks: async () => {
      throw new Error('network down');
    },
  };

  await env.loadBooks();

  assert.equal(grid.children.length, 1);
  assert.ok(grid.children[0].innerHTML.includes('Offline'));
});

test('loadBooks renders the empty state when there are no books', async () => {
  const env = loadApp();
  const grid = env.document.addElement('books-grid');

  await env.loadBooks();

  assert.ok(grid.innerHTML.includes('No Books Yet'));
  assert.equal(grid.children.length, 0);
});

test('loadBooks is a no-op when the grid is missing', async () => {
  const env = loadApp({ autoCreate: false });
  await env.loadBooks();
  assert.equal(env.document.getElementById('books-grid'), null);
});

test('updateHeroStats survives a failing happy-readers lookup', async () => {
  const env = loadApp();
  env.window.SupabaseAPI = {
    countHappyReaders: async () => {
      throw new Error('nope');
    },
  };

  await env.updateHeroStats([{ id: 1 }, { id: 2 }]);

  assert.equal(env.document.getElementById('books-count').textContent, '2');
  assert.equal(env.document.getElementById('readers-count').textContent, '0');
  assert.equal(env.logs.warn.length, 1);
});

test('checkAuthState promotes a Supabase session to the author UI', async () => {
  const env = loadApp();
  env.localStorage.setItem('currentUser', 'stale');
  env.window.SupabaseAPI = {
    getSession: async () => ({ user: { email: 'author@archazz.com' } }),
  };

  env.checkAuthState();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(env.bindings.currentUser.email, 'author@archazz.com');
  assert.equal(env.bindings.currentUser.role, 'author');
  assert.equal(env.document.getElementById('auth-buttons').style.display, 'none');
  assert.equal(env.document.getElementById('user-menu').style.display, 'flex');
  assert.equal(env.document.getElementById('user-name').textContent, 'Archazz (Author)');
  assert.equal(env.document.getElementById('dashboard-link').href, 'dashboard.html');
});

test('checkAuthState clears stale local state without a session', async () => {
  const env = loadApp();
  env.localStorage.setItem('currentUser', 'stale');
  env.window.SupabaseAPI = { getSession: async () => null };

  env.checkAuthState();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(env.localStorage.getItem('currentUser'), null);
  assert.equal(env.bindings.currentUser, null);
});

test('handleLogin signs in, greets the user and redirects', async () => {
  const env = loadApp();
  env.document.addElement('login-username', 'input').value = 'author@archazz.com';
  env.document.addElement('login-password', 'input').value = 'secret';

  const calls = [];
  env.window.SupabaseAPI = {
    signIn: async (email, password) => {
      calls.push([email, password]);
      return { user: { email } };
    },
  };

  let prevented = false;
  await env.handleLogin({ preventDefault: () => { prevented = true; } });

  assert.equal(prevented, true);
  assert.deepEqual(toPlain(calls), [['author@archazz.com', 'secret']]);
  assert.equal(env.bindings.currentUser.name, 'Archazz');
  assert.equal(env.document.getElementById('login-modal').classList.contains('active'), false);
  assert.ok(env.document.body.children.some((c) => c.textContent === 'Welcome back, Archazz!'));
});

test('handleLogin alerts on invalid credentials', async () => {
  const env = loadApp();
  env.document.addElement('login-username', 'input').value = 'nope@archazz.com';
  env.document.addElement('login-password', 'input').value = 'wrong';
  env.window.SupabaseAPI = {
    signIn: async () => {
      throw new Error('invalid');
    },
  };

  await env.handleLogin({ preventDefault() {} });

  assert.deepEqual(env.window.alerts, ['Invalid author credentials. Please try again.']);
  assert.equal(env.bindings.currentUser, null);
});

test('logout signs out, resets the navbar and clears local state', async () => {
  const env = loadApp();
  let signedOut = false;
  env.window.SupabaseAPI = {
    signOut: async () => {
      signedOut = true;
    },
  };
  env.localStorage.setItem('currentUser', 'x');

  await env.logout();

  assert.equal(signedOut, true);
  assert.equal(env.localStorage.getItem('currentUser'), null);
  assert.equal(env.document.getElementById('auth-buttons').style.display, 'flex');
  assert.equal(env.document.getElementById('user-menu').style.display, 'none');
});

test('modal helpers toggle the active class and body scroll', () => {
  const env = loadApp();
  const modal = env.document.addElement('login-modal');

  env.showLoginModal();
  assert.equal(modal.classList.contains('active'), true);
  assert.equal(env.document.body.style.overflow, 'hidden');

  env.closeModal('login-modal');
  assert.equal(modal.classList.contains('active'), false);
  assert.equal(env.document.body.style.overflow, 'auto');

  env.switchToLogin();
  assert.equal(modal.classList.contains('active'), true);
  assert.equal(env.document.getElementById('register-modal').classList.contains('active'), false);
});

test('showBookDetails fills the modal from the matching book', async () => {
  const env = loadApp();
  env.window.SupabaseAPI = {
    fetchBooks: async () => [
      { id: 1, title: 'Other' },
      {
        id: 2,
        title: 'Target',
        author_name: 'Archazz',
        cover_url: 'cover.png',
        created_at: '2024-06-01T00:00:00.000Z',
        pages: 33,
        preview: 'Preview text',
      },
    ],
  };

  await env.showBookDetails(2);

  assert.equal(env.document.getElementById('modal-book-title').textContent, 'Target');
  assert.equal(env.document.getElementById('modal-book-cover').src, 'cover.png');
  assert.equal(env.document.getElementById('modal-book-date').textContent, 'Jun 1, 2024');
  assert.equal(env.document.getElementById('modal-book-pages').textContent, '33');
  assert.equal(env.document.getElementById('book-modal').dataset.bookId, 2);
  assert.equal(env.document.getElementById('book-modal').classList.contains('active'), true);
});

test('showBookDetails ignores unknown book ids', async () => {
  const env = loadApp();
  env.window.SupabaseAPI = { fetchBooks: async () => [{ id: 1 }] };

  await env.showBookDetails(999);

  assert.equal(env.document.getElementById('book-modal').classList.contains('active'), false);
});

test('readBook navigates to the reader for the selected book', () => {
  const env = loadApp();
  env.document.addElement('book-modal').dataset.bookId = 42;

  env.readBook();

  assert.equal(env.window.location.href, 'reader.html?id=42');
});

test('animateNumber ends on the target value', async () => {
  const env = loadApp();
  const element = env.document.createElement('span');

  env.animateNumber(element, 0, 1500, 5);
  await new Promise((resolve) => setTimeout(resolve, 40));

  assert.equal(element.textContent, (1500).toLocaleString());
});
