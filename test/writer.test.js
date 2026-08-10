const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load-script');
const { toPlain } = require('./helpers/fake-dom');

const BINDINGS = ['currentBook', 'currentChapterId', 'pageEditors', 'isEditMode', 'editingBookId'];

// Stand-in for the Quill rich-text editor loaded from a CDN in the browser.
class FakeQuill {
  static import() {
    return { whitelist: [] };
  }

  static register() {}

  constructor(selector) {
    this.selector = selector;
    this.root = { innerHTML: '' };
    this.handlers = new Map();
    this.clipboard = {
      dangerouslyPasteHTML: (_index, html) => {
        this.root.innerHTML = html;
      },
    };
  }

  format() {}

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  getText() {
    return this.root.innerHTML.replace(/<[^>]*>/g, ' ');
  }
}

function loadWriter(options = {}) {
  const { globals = {}, ...rest } = options;
  return loadScript('writer.js', {
    bindings: BINDINGS,
    globals: { Quill: FakeQuill, ...globals },
    ...rest,
  });
}

// Minimal stand-in for a Quill editor instance.
function fakeEditor(html) {
  return {
    root: { innerHTML: html },
    getText: () => html.replace(/<[^>]*>/g, ' '),
  };
}

test('stripHtml returns the text content of markup', () => {
  const env = loadWriter();
  assert.equal(env.stripHtml('<p>Hello <strong>world</strong></p>'), 'Hello world');
  assert.equal(env.stripHtml(''), '');
});

test('generatePreview truncates the first page to 150 characters', () => {
  const env = loadWriter();

  env.bindings.currentBook.chapters[0].pages[0].content = '<p>Short opening</p>';
  assert.equal(env.generatePreview(), 'Short opening');

  const long = 'x'.repeat(200);
  env.bindings.currentBook.chapters[0].pages[0].content = `<p>${long}</p>`;
  const preview = env.generatePreview();
  assert.equal(preview.length, 153);
  assert.ok(preview.endsWith('...'));

  env.bindings.currentBook = { chapters: [] };
  assert.equal(env.generatePreview(), '');
});

test('getCurrentChapter resolves the selected chapter', () => {
  const env = loadWriter();
  env.bindings.currentBook.chapters.push({ id: 99, title: 'Chapter 2', pages: [] });

  assert.equal(env.getCurrentChapter().id, 1);
  env.bindings.currentChapterId = 99;
  assert.equal(env.getCurrentChapter().title, 'Chapter 2');
});

test('newChapter appends a draft chapter and selects it', () => {
  const env = loadWriter();
  env.window.promptResponses.push('Chapter 2');

  env.newChapter();

  const chapters = env.bindings.currentBook.chapters;
  assert.equal(chapters.length, 2);
  assert.equal(chapters[1].title, 'Chapter 2');
  assert.equal(chapters[1].status, 'draft');
  assert.equal(chapters[1].pages.length, 1);
  assert.equal(env.bindings.currentChapterId, chapters[1].id);
});

test('newChapter is cancelled when the prompt is dismissed', () => {
  const env = loadWriter();
  env.window.promptResponses.push('');

  env.newChapter();

  assert.equal(env.bindings.currentBook.chapters.length, 1);
});

test('deleteChapter refuses to remove the only chapter', () => {
  const env = loadWriter();

  env.deleteChapter(1);

  assert.equal(env.bindings.currentBook.chapters.length, 1);
  assert.deepEqual(toPlain(env.window.alerts), ['Cannot delete the last chapter']);
});

test('deleteChapter removes a chapter and falls back to the first one', () => {
  const env = loadWriter();
  env.bindings.currentBook.chapters.push({ id: 2, title: 'Chapter 2', pages: [{ id: 5 }] });
  env.bindings.currentChapterId = 2;

  env.deleteChapter(2);

  assert.equal(env.bindings.currentBook.chapters.length, 1);
  assert.equal(env.bindings.currentChapterId, 1);
});

test('deleteChapter honours a cancelled confirmation', () => {
  const env = loadWriter();
  env.bindings.currentBook.chapters.push({ id: 2, title: 'Chapter 2', pages: [] });
  env.window.confirmResponses.push(false);

  env.deleteChapter(2);

  assert.equal(env.bindings.currentBook.chapters.length, 2);
});

test('editChapterTitle trims the new title and ignores blank input', () => {
  const env = loadWriter();

  env.window.promptResponses.push('  Renamed  ');
  env.editChapterTitle(1);
  assert.equal(env.bindings.currentBook.chapters[0].title, 'Renamed');

  env.window.promptResponses.push('   ');
  env.editChapterTitle(1);
  assert.equal(env.bindings.currentBook.chapters[0].title, 'Renamed');
});

test('addNewPage and deletePage keep at least one page per chapter', () => {
  const env = loadWriter();

  env.addNewPage();
  assert.equal(env.bindings.currentBook.chapters[0].pages.length, 2);

  const [, second] = env.bindings.currentBook.chapters[0].pages;
  env.deletePage(second.id);
  assert.equal(env.bindings.currentBook.chapters[0].pages.length, 1);

  env.deletePage(env.bindings.currentBook.chapters[0].pages[0].id);
  assert.equal(env.bindings.currentBook.chapters[0].pages.length, 1);
  assert.deepEqual(toPlain(env.window.alerts), ['Cannot delete the last page of a chapter']);
});

test('updateStats counts words, pages and chapters across the book', () => {
  const env = loadWriter();
  env.bindings.currentBook.chapters = [
    {
      id: 1,
      title: 'One',
      pages: [{ id: 1, content: '<p>one two three</p>' }, { id: 2, content: '' }],
    },
    { id: 2, title: 'Two', pages: [{ id: 3, content: '<p>four five</p>' }] },
  ];

  env.updateStats();

  assert.equal(env.document.getElementById('total-words').textContent, '5');
  assert.equal(env.document.getElementById('total-pages-count').textContent, '3');
  assert.equal(env.document.getElementById('total-chapters').textContent, '2');
});

test('updateChapterSelector and renderChapterList mirror the chapter list', () => {
  const env = loadWriter();
  env.bindings.currentBook.chapters.push({ id: 2, title: 'Chapter 2', pages: [{ id: 3 }] });

  env.updateChapterSelector();
  env.renderChapterList();

  const selector = env.document.getElementById('chapter-selector');
  assert.deepEqual(
    toPlain(selector.children.map((option) => option.textContent)),
    ['Chapter 1', 'Chapter 2'],
  );
  assert.equal(selector.children[0].selected, true);

  const list = env.document.getElementById('chapter-list');
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0].classList.contains('active'), true);
  assert.ok(list.children[1].innerHTML.includes('1 page(s)'));
});

test('savePageContent writes the editor HTML back to the page model', () => {
  const env = loadWriter();
  env.bindings.pageEditors.set(1, fakeEditor('<p>Draft text</p>'));

  env.savePageContent(1);

  assert.equal(env.bindings.currentBook.chapters[0].pages[0].content, '<p>Draft text</p>');
});

test('updatePageWordCount renders the count and ignores unknown pages', () => {
  const env = loadWriter();
  env.bindings.pageEditors.set(1, fakeEditor('<p>one two three four</p>'));

  assert.equal(env.updatePageWordCount(1), 4);
  assert.equal(env.document.getElementById('word-count-1').textContent, '4 words');
  assert.equal(env.updatePageWordCount(404), undefined);
});

test('saveBook requires a title', async () => {
  const env = loadWriter();
  env.bindings.currentBook.title = '';

  await env.saveBook('draft');

  assert.deepEqual(toPlain(env.window.alerts), ['Please enter a book title']);
});

test('saveBook publishes the current chapter and creates the Supabase row', async () => {
  const env = loadWriter();
  env.document.addElement('book-genre', 'select').value = 'fantasy';
  env.bindings.currentBook.title = 'My Story';
  env.bindings.currentBook.chapters[0].pages[0].content = '<p>Once upon a time</p>';

  const created = [];
  env.window.SupabaseAPI = {
    createBook: async (data) => {
      created.push(data);
      return { id: 'uuid-1', created_at: '2024-04-01T00:00:00.000Z' };
    },
  };

  await env.saveBook('published');

  assert.equal(created.length, 1);
  assert.equal(created[0].title, 'My Story');
  assert.equal(created[0].genre, 'fantasy');
  assert.equal(created[0].pages, 1);
  assert.equal(created[0].status, 'published');
  assert.equal(created[0].preview, 'Once upon a time');
  assert.equal(env.bindings.currentBook.chapters[0].status, 'published');
  assert.equal(env.bindings.isEditMode, true);
  assert.equal(env.bindings.editingBookId, 'uuid-1');

  const stored = JSON.parse(env.localStorage.getItem('books'));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, 'uuid-1');
  assert.equal(stored[0].status, 'published');
});

test('saveBook in edit mode updates the existing book in place', async () => {
  const env = loadWriter();
  env.bindings.currentBook.title = 'Existing';
  env.bindings.isEditMode = true;
  env.bindings.editingBookId = 'uuid-9';
  env.localStorage.setItem(
    'books',
    JSON.stringify([{ id: 'uuid-9', title: 'Old title' }, { id: 'other' }]),
  );

  const updates = [];
  env.window.SupabaseAPI = {
    updateBook: async (id, data) => {
      updates.push([id, data]);
      return { id, created_at: '2024-04-02T00:00:00.000Z' };
    },
  };

  await env.saveBook('draft', true);

  assert.equal(updates.length, 1);
  assert.equal(updates[0][0], 'uuid-9');
  const stored = JSON.parse(env.localStorage.getItem('books'));
  assert.equal(stored.length, 2);
  assert.equal(stored[0].title, 'Existing');
});

test('saveBook keeps the book published when another chapter is live', async () => {
  const env = loadWriter();
  env.bindings.currentBook.title = 'Mixed';
  env.bindings.currentBook.chapters = [
    { id: 1, title: 'One', status: 'published', pages: [{ id: 1, content: '<p>a</p>' }] },
    { id: 2, title: 'Two', status: 'draft', pages: [{ id: 2, content: '' }] },
  ];
  env.bindings.currentChapterId = 2;

  const created = [];
  env.window.SupabaseAPI = { createBook: async (data) => { created.push(data); return { id: 1 }; } };

  await env.saveBook('draft', true);

  assert.equal(created[0].status, 'published');
  assert.equal(env.bindings.currentBook.chapters[1].status, 'draft');
  assert.equal(created[0].pages, 2);
});

test('saveBook reports failures without throwing', async () => {
  const env = loadWriter();
  env.bindings.currentBook.title = 'Broken';
  env.window.SupabaseAPI = {
    createBook: async () => {
      throw new Error('supabase down');
    },
  };

  await env.saveBook('draft');

  assert.ok(
    env.document.body.children.some((c) => c.textContent === 'Failed to save book. Please try again.'),
  );
});

test('checkWriterAuth redirects when there is no session', async () => {
  const env = loadWriter();
  env.window.SupabaseAPI = { getSession: async () => null };

  assert.equal(await env.checkWriterAuth(), false);
  assert.equal(env.window.location.href, 'index.html');
});

test('checkWriterAuth accepts a valid session', async () => {
  const env = loadWriter();
  env.window.SupabaseAPI = { getSession: async () => ({ user: { email: 'a@b.c' } }) };

  assert.equal(await env.checkWriterAuth(), true);
  assert.equal(env.document.getElementById('user-name').textContent, 'Archazz');
  assert.equal(env.bindings.currentBook.author, 'Archazz');
});

test('checkEditMode loads the requested book and normalises numeric ids', async () => {
  const env = loadWriter();
  env.window.location.search = '?id=123';
  env.window.SupabaseAPI = {
    fetchBooks: async () => [
      {
        id: 123,
        title: 'Cloud Book',
        cover_url: 'cover.png',
        chapters: [{ id: 1, title: 'Chapter 1', pages: [{ id: 1, content: '<p>hi</p>' }] }],
      },
    ],
  };

  await env.checkEditMode();

  assert.equal(env.bindings.isEditMode, true);
  assert.equal(env.bindings.editingBookId, 123);
  assert.equal(env.bindings.currentBook.title, 'Cloud Book');
  assert.equal(env.bindings.currentBook.cover, 'cover.png');
});

test('checkEditMode stays in create mode without an id', async () => {
  const env = loadWriter();
  env.window.location.search = '';

  await env.checkEditMode();

  assert.equal(env.bindings.isEditMode, false);
  assert.equal(env.bindings.editingBookId, null);
});

test('logout clears local state and returns to the home page once confirmed', () => {
  const env = loadWriter();
  env.localStorage.setItem('currentUser', 'x');

  env.window.confirmResponses.push(false);
  env.logout();
  assert.equal(env.localStorage.getItem('currentUser'), 'x');

  env.window.confirmResponses.push(true);
  env.logout();
  assert.equal(env.localStorage.getItem('currentUser'), null);
  assert.equal(env.window.location.href, 'index.html');
});
