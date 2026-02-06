// =============================
// WRITER INITIALIZATION
// =============================

let currentBook = {
  id: null,
  title: 'Untitled Story',
  author: 'Archazz',
  cover: null,
  chapters: [
    {
      id: 1,
      title: 'Chapter 1',
      pages: [
        {
          id: 1,
          content: '',
        },
      ],
    },
  ],
};

let currentChapterId = 1;
let pageEditors = new Map(); // Store Quill instances for each page
let isEditMode = false;
let editingBookId = null;

// =============================
// LOCALSTORAGE UTILITIES
// =============================

// Get books from localStorage with fallback
function getBooksFromStorage() {
  try {
    const savedBooks = localStorage.getItem('books');
    if (savedBooks) {
      const parsed = JSON.parse(savedBooks);
      console.log('📚 Retrieved ' + parsed.length + ' books from localStorage');
      return parsed;
    }
  } catch (e) {
    console.error('❌ Error reading books from localStorage:', e);
  }
  return [];
}

// Save books to localStorage with verification
function saveBooksToStorage(booksData) {
  try {
    localStorage.setItem('books', JSON.stringify(booksData));
    // Verify save
    const verify = localStorage.getItem('books');
    if (verify) {
      console.log(
        '✅ Successfully saved ' + booksData.length + ' books to localStorage',
      );
      return true;
    } else {
      console.error('❌ Verification failed - data may not have been saved');
      return false;
    }
  } catch (e) {
    console.error('❌ Error saving books to localStorage:', e);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // Check authentication
  checkWriterAuth();

  // Check if editing existing book
  checkEditMode();

  // Initialize
  setTimeout(() => {
    initializeWriter();
    updateStats();
    renderChapterList();
  }, 100);
});

// =============================
// AUTHENTICATION
// =============================

function checkWriterAuth() {
  const savedUser = localStorage.getItem('currentUser');

  if (!savedUser) {
    window.location.href = 'index.html';
    return;
  }

  const user = JSON.parse(savedUser);

  if (user.role !== 'author') {
    alert('Access denied. Author privileges required.');
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('user-name').textContent = user.name;
  currentBook.author = user.name;
}

// =============================
// EDIT MODE CHECK
// =============================

async function checkEditMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const bookId = parseInt(urlParams.get('id'));

  if (bookId) {
    isEditMode = true;
    editingBookId = bookId;
    await loadExistingBook(bookId);
  }
}

async function loadExistingBook(bookId) {
  let book = null;
  
  // 1. Try Local Storage first
  const localBooks = getBooksFromStorage();
  book = localBooks.find((b) => b.id === bookId);

  // 2. If not found locally, try Supabase
  if (!book && window.SupabaseAPI) {
    try {
      console.log(`🔍 Book ${bookId} not in local storage. Fetching from Supabase...`);
      // We need a specific fetch method for single book or filter from list
      // Since fetchBookById might not exist yet, we fetch all (cached usually) or specific
      const sbBooks = await window.SupabaseAPI.fetchBooks(); 
      book = sbBooks.find(b => b.id === bookId);
    } catch (err) {
      console.error('❌ Error fetching from Supabase:', err);
    }
  }

  if (!book) {
    console.error('❌ Book with ID ' + bookId + ' not found anywhere.');
    alert('Book not found. Returning to dashboard.');
    window.location.href = 'dashboard.html';
    return;
  }

  console.log('✅ Found book for editing:', book.title);

  // If fetched from Supabase, ensure we don't overwrite it as a "new" local book
  // (Handling logic continues below...)

  console.log('✅ Found book for editing:', book.title);

  // Convert old format to new chapter-based format
  if (!book.chapters) {
    // Old format - convert
    currentBook = {
      id: book.id,
      title: book.title,
      author: book.author,
      cover: book.cover,
      chapters: [
        {
          id: 1,
          title: 'Chapter 1',
          pages: [
            {
              id: 1,
              content: book.story,
            },
          ],
        },
      ],
    };
  } else {
    // New format
    currentBook = book;
  }

  document.getElementById('book-title').value = currentBook.title;

  // Load genre if exists
  if (currentBook.genre) {
    document.getElementById('book-genre').value = currentBook.genre;
  }

  // Load and display existing cover
  if (currentBook.cover) {
    // Display in modal (for upload flow)
    document.getElementById('preview-img').src = currentBook.cover;
    document.getElementById('cover-preview').style.display = 'flex';
    
    // Display in sidebar
    document.getElementById('sidebar-cover-preview').src = currentBook.cover;
    document.getElementById('cover-display-card').style.display = 'block';
    
    // Update upload UI to show cover is already uploaded
    const uploadDiv = document.getElementById('cover-upload');
    if (uploadDiv) {
      uploadDiv.innerHTML = `
        <i class="fas fa-check-circle" style="color: #10B981; font-size: 3rem;"></i>
        <p><strong>Cover already uploaded</strong></p>
        <p style="color: var(--gray); font-size: 0.875rem;">Click to change</p>
      `;
    }
  }

  console.log('✏️ Edit mode loaded for book:', currentBook.title);

  // Show edit mode notification for mobile
  if (window.innerWidth <= 768) {
    showNotification('📝 Editing: ' + currentBook.title);
  }
}

// =============================
// WRITER INITIALIZATION
// =============================

function initializeWriter() {
  // Register custom Quill fonts
  const Font = Quill.import('formats/font');
  Font.whitelist = [
    'times-new-roman',
    'arial',
    'georgia',
    'courier',
    'verdana',
  ];
  Quill.register(Font, true);

  // Render current chapter pages
  renderCurrentChapter();

  // Setup title input listener
  document.getElementById('book-title').addEventListener('input', function (e) {
    currentBook.title = e.target.value;
    updateStats();
  });

  // Setup chapter selector
  document
    .getElementById('chapter-selector')
    .addEventListener('change', function (e) {
      currentChapterId = parseInt(e.target.value);
      renderCurrentChapter();
    });

  // Show mobile cover button on small screens
  const mobileCoverBtn = document.getElementById('mobile-cover-btn');
  if (mobileCoverBtn) {
    if (window.innerWidth <= 768) {
      mobileCoverBtn.style.display = 'flex';
    }
  }

  // Update mobile button visibility on resize
  window.addEventListener('resize', function () {
    if (mobileCoverBtn) {
      mobileCoverBtn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    }
  });
}

// =============================
// CHAPTER MANAGEMENT
// =============================

function getCurrentChapter() {
  return currentBook.chapters.find((c) => c.id === currentChapterId);
}

function newChapter() {
  const chapterNumber = currentBook.chapters.length + 1;
  const newChapterId = Date.now();

  const chapterTitle = prompt(
    `Enter title for Chapter ${chapterNumber}:`,
    `Chapter ${chapterNumber}`,
  );
  if (!chapterTitle) return;

  const newChapter = {
    id: newChapterId,
    title: chapterTitle,
    pages: [
      {
        id: Date.now() + 1,
        content: '',
      },
    ],
  };

  currentBook.chapters.push(newChapter);
  currentChapterId = newChapterId;

  updateChapterSelector();
  renderChapterList();
  renderCurrentChapter();
  updateStats();

  showNotification(`${chapterTitle} created!`);
}

function deleteChapter(chapterId) {
  if (currentBook.chapters.length === 1) {
    alert('Cannot delete the last chapter');
    return;
  }

  const chapter = currentBook.chapters.find((c) => c.id === chapterId);
  if (!confirm(`Delete "${chapter.title}"? This cannot be undone.`)) return;

  currentBook.chapters = currentBook.chapters.filter((c) => c.id !== chapterId);

  // Switch to first chapter
  currentChapterId = currentBook.chapters[0].id;

  updateChapterSelector();
  renderChapterList();
  renderCurrentChapter();
  updateStats();

  showNotification('Chapter deleted');
}

function editChapterTitle(chapterId) {
  const chapter = currentBook.chapters.find((c) => c.id === chapterId);
  const newTitle = prompt('Enter new chapter title:', chapter.title);

  if (newTitle && newTitle.trim()) {
    chapter.title = newTitle.trim();
    updateChapterSelector();
    renderChapterList();
    updateStats();
  }
}

function updateChapterSelector() {
  const selector = document.getElementById('chapter-selector');
  selector.innerHTML = '';

  currentBook.chapters.forEach((chapter) => {
    const option = document.createElement('option');
    option.value = chapter.id;
    option.textContent = chapter.title;
    option.selected = chapter.id === currentChapterId;
    selector.appendChild(option);
  });
}

function renderChapterList() {
  const list = document.getElementById('chapter-list');
  list.innerHTML = '';

  currentBook.chapters.forEach((chapter, index) => {
    const item = document.createElement('div');
    item.className = 'chapter-item';
    if (chapter.id === currentChapterId) {
      item.classList.add('active');
    }

    item.innerHTML = `
            <div class="chapter-info">
                <strong>${chapter.title}</strong>
                <span>${chapter.pages.length} page(s)</span>
            </div>
            <div class="chapter-actions">
                <button class="chapter-action-btn" onclick="editChapterTitle(${chapter.id})" title="Edit title">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="chapter-action-btn delete" onclick="deleteChapter(${chapter.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

    item.addEventListener('click', function (e) {
      if (!e.target.closest('.chapter-actions')) {
        currentChapterId = chapter.id;
        document.getElementById('chapter-selector').value = chapter.id;
        renderCurrentChapter();
        renderChapterList();
      }
    });

    list.appendChild(item);
  });

  updateChapterSelector();
}

// =============================
// PAGE MANAGEMENT
// =============================

function renderCurrentChapter() {
  const chapter = getCurrentChapter();
  const container = document.getElementById('pages-container');
  container.innerHTML = '';

  // Clear existing editors
  pageEditors.clear();

  // Render each page
  chapter.pages.forEach((page, index) => {
    const pageEl = createPageElement(page, index + 1, chapter.pages.length);
    container.appendChild(pageEl);

    // Initialize Quill editor for this page
    initializePageEditor(page.id, page.content);
  });

  // Add "Add Page" button
  const addPageBtn = document.createElement('button');
  addPageBtn.className = 'add-page-btn';
  addPageBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Page';
  addPageBtn.onclick = addNewPage;
  container.appendChild(addPageBtn);
}

function createPageElement(page, pageNumber, totalPages) {
  const pageWrapper = document.createElement('div');
  pageWrapper.className = 'page-wrapper';
  pageWrapper.id = `page-wrapper-${page.id}`;

  pageWrapper.innerHTML = `
        <div class="page-header-info">
            <span class="page-word-count" id="word-count-${page.id}">0 words</span>
            <span class="page-number-badge">Page ${pageNumber}</span>
            ${
              totalPages > 1
                ? `<button class="page-delete-btn" onclick="deletePage(${page.id})" title="Delete page">
                <i class="fas fa-trash"></i>
            </button>`
                : ''
            }
        </div>
        <div class="page-toolbar-area" id="toolbar-${page.id}">
            <!-- Toolbar will be here, OUTSIDE card -->
        </div>
        <div class="page-content-card">
            <div class="page-editor" id="editor-container-${page.id}">
                <div id="editor-${page.id}"></div>
            </div>
        </div>
    `;

  return pageWrapper;
}

function initializePageEditor(pageId, initialContent) {
  const editorId = `editor-${pageId}`;
  const toolbarId = `toolbar-${pageId}`;

  const quill = new Quill(`#${editorId}`, {
    theme: 'snow',
    placeholder: 'Start writing your story...',
    modules: {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          [
            {
              font: [
                'times-new-roman',
                'arial',
                'georgia',
                'courier',
                'verdana',
              ],
            },
          ],
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          ['link', 'clean'],
        ],
      },
    },
  });

  // Move the auto-generated toolbar to our custom container
  const autoGeneratedToolbar = document.querySelector(
    `#editor-container-${pageId} .ql-toolbar`,
  );
  const toolbarContainer = document.getElementById(toolbarId);

  if (autoGeneratedToolbar && toolbarContainer) {
    toolbarContainer.appendChild(autoGeneratedToolbar);
  }

  // Set default font
  quill.format('font', 'times-new-roman');

  // Load initial content
  if (initialContent) {
    quill.root.innerHTML = initialContent;
  }

  // Store editor instance
  pageEditors.set(pageId, quill);

  // Update word count on text change
  quill.on('text-change', function () {
    updatePageWordCount(pageId);
    savePageContent(pageId);
    updateStats();
    checkPageOverflow(pageId);
  });

  // Initial word count
  updatePageWordCount(pageId);
}

function updatePageWordCount(pageId) {
  const editor = pageEditors.get(pageId);
  if (!editor) return;

  const text = editor.getText().trim();
  const wordCount = text ? text.split(/\s+/).length : 0;

  const wordCountEl = document.getElementById(`word-count-${pageId}`);
  if (wordCountEl) {
    wordCountEl.textContent = `${wordCount} words`;
  }

  return wordCount;
}

function savePageContent(pageId) {
  const editor = pageEditors.get(pageId);
  if (!editor) return;

  const chapter = getCurrentChapter();
  const page = chapter.pages.find((p) => p.id === pageId);

  if (page) {
    page.content = editor.root.innerHTML;
  }
}

function checkPageOverflow(pageId) {
  const editor = pageEditors.get(pageId);
  if (!editor) return;

  const chapter = getCurrentChapter();
  const currentPageIndex = chapter.pages.findIndex((p) => p.id === pageId);

  // Check if this is the last page
  if (currentPageIndex !== chapter.pages.length - 1) return;

  // Check word count - suggest new page at ~500 words
  const wordCount = updatePageWordCount(pageId);
  if (wordCount > 500) {
    // Show subtle notification
    const pageEl = document.getElementById(`page-${pageId}`);
    if (pageEl && !pageEl.dataset.notified) {
      pageEl.dataset.notified = 'true';

      // Add visual indicator
      const indicator = document.createElement('div');
      indicator.style.cssText = `
                position: absolute;
                bottom: 1rem;
                right: 1rem;
                background: rgba(239, 68, 68, 0.9);
                color: white;
                padding: 0.75rem 1rem;
                border-radius: var(--radius-md);
                font-size: 0.875rem;
                cursor: pointer;
            `;
      indicator.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Page getting full. <strong>Add new page?</strong>';
      indicator.onclick = function () {
        addNewPage();
        indicator.remove();
      };

      pageEl.appendChild(indicator);
    }
  }
}

function addNewPage() {
  const chapter = getCurrentChapter();
  const newPageId = Date.now();

  const newPage = {
    id: newPageId,
    content: '',
  };

  chapter.pages.push(newPage);
  renderCurrentChapter();
  updateStats();

  // Scroll to new page
  setTimeout(() => {
    const newPageEl = document.getElementById(`page-${newPageId}`);
    if (newPageEl) {
      newPageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);

  showNotification('New page added');
}

function deletePage(pageId) {
  const chapter = getCurrentChapter();

  if (chapter.pages.length === 1) {
    alert('Cannot delete the last page of a chapter');
    return;
  }

  if (!confirm('Delete this page? This cannot be undone.')) return;

  chapter.pages = chapter.pages.filter((p) => p.id !== pageId);
  renderCurrentChapter();
  updateStats();

  showNotification('Page deleted');
}

// =============================
// STATISTICS
// =============================

function updateStats() {
  // Total words
  let totalWords = 0;
  currentBook.chapters.forEach((chapter) => {
    chapter.pages.forEach((page) => {
      const text = page.content ? stripHtml(page.content).trim() : '';
      if (text) {
        totalWords += text.split(/\s+/).length;
      }
    });
  });

  // Total pages
  let totalPages = 0;
  currentBook.chapters.forEach((chapter) => {
    totalPages += chapter.pages.length;
  });

  // Update UI
  document.getElementById('total-words').textContent =
    totalWords.toLocaleString();
  document.getElementById('total-pages-count').textContent = totalPages;
  document.getElementById('total-chapters').textContent =
    currentBook.chapters.length;
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// =============================
// SAVE & PUBLISH
// =============================

function saveBook() {
  // Validate
  if (!currentBook.title || currentBook.title.trim() === '') {
    alert('Please enter a book title');
    return;
  }

  if (!currentBook.cover) {
    if (!confirm('No cover image uploaded. Continue without cover?')) {
      return;
    }
  }

  // Save all current page contents
  pageEditors.forEach((editor, pageId) => {
    savePageContent(pageId);
  });

  // Calculate total pages for backward compatibility
  let totalPages = 0;
  currentBook.chapters.forEach((chapter) => {
    totalPages += chapter.pages.length;
  });

  // Prepare book data
  const bookData = {
    ...currentBook,
    id: currentBook.id || Date.now(),
    title: currentBook.title,
    author: currentBook.author,
    genre: document.getElementById('book-genre').value || 'other',
    date: currentBook.date || new Date().toISOString().split('T')[0],
    pages: totalPages,
    // Generate preview from first chapter
    preview: generatePreview(),
  };

  // Get existing books using robust utility
  let books = getBooksFromStorage();

  if (isEditMode && editingBookId) {
    // Update existing book
    const index = books.findIndex((b) => b.id === editingBookId);
    if (index !== -1) {
      books[index] = bookData;
    } else {
      books.push(bookData);
    }
  } else {
    // New book
    books.push(bookData);
  }

  // Save to localStorage (Local Backup)
  saveBooksToStorage(books);

  // SAVE TO SUPABASE (Cloud Sync)
  if (window.SupabaseAPI) {
    // Show uploading status
    const saveBtn = document.querySelector('.save-btn');
    const originalText = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving to Cloud...';

    // Async save
    window.SupabaseAPI.saveBook(bookData)
      .then(() => {
        console.log('✅ Book synced to Supabase!');
        showNotification('Book saved & synced to cloud!');
        
        // Redirect only after successful cloud save
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);
      })
      .catch((err) => {
        console.error('❌ Cloud Sync failed:', err);
        showNotification('Saved locally, but Cloud Sync failed.');
        
        // Restore button
        if (saveBtn) saveBtn.innerHTML = originalText;
        
        // Still redirect because local save worked
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 2000);
      });
  } else {
    // Fallback if no Supabase
    showNotification('Book saved locally (Offline mode)');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
  }
}

function generatePreview() {
  if (currentBook.chapters.length === 0) return '';

  const firstChapter = currentBook.chapters[0];
  if (firstChapter.pages.length === 0) return '';

  const firstPage = firstChapter.pages[0];
  const text = stripHtml(firstPage.content);

  // Get first 150 characters
  return text.substring(0, 150) + (text.length > 150 ? '...' : '');
}

// =============================
// COVER UPLOAD
// =============================

function uploadCover() {
  document.getElementById('cover-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function handleCoverUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    alert('File size must be less than 5MB');
    return;
  }

  // Read file
  const reader = new FileReader();
  reader.onload = function (e) {
    currentBook.cover = e.target.result;

    // Show preview in modal
    document.getElementById('preview-img').src = currentBook.cover;
    document.getElementById('cover-preview').style.display = 'flex';

    // Show preview in sidebar
    document.getElementById('sidebar-cover-preview').src = currentBook.cover;
    document.getElementById('cover-display-card').style.display = 'block';

    // Update upload UI
    const uploadDiv = document.getElementById('cover-upload');
    uploadDiv.innerHTML = `
            <i class="fas fa-check-circle" style="color: #10B981; font-size: 3rem;"></i>
            <p><strong>Cover uploaded successfully</strong></p>
            <p style="color: var(--gray); font-size: 0.875rem;">Click to change</p>
        `;

    showNotification('Cover uploaded!');
  };

  reader.readAsDataURL(file);
}

// =============================
// PREVIEW
// =============================

function previewBook() {
  // Save current state
  pageEditors.forEach((editor, pageId) => {
    savePageContent(pageId);
  });

  // Create temporary preview
  const previewWindow = window.open('', '_blank');

  const previewHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${currentBook.title} - Preview</title>
            <link rel="stylesheet" href="styles.css">
            <style>
                body {
                    background: var(--gray-lighter);
                    padding: 2rem;
                    font-family: 'Times New Roman', Times, serif;
                }
                .preview-container {
                    max-width: 21cm;
                    margin: 0 auto;
                }
                .preview-page {
                    background: white;
                    padding: 3rem 2.5rem;
                    margin-bottom: 2rem;
                    border-radius: var(--radius-lg);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    min-height: 29.7cm;
                }
                .chapter-title {
                    font-size: 2rem;
                    margin-bottom: 2rem;
                    text-align: center;
                    font-family: 'Playfair Display', serif;
                }
                h1 {
                    text-align: center;
                    margin-bottom: 3rem;
                    font-family: 'Playfair Display', serif;
                }
            </style>
        </head>
        <body>
            <div class="preview-container">
                <h1>${currentBook.title}</h1>
                ${currentBook.chapters
                  .map(
                    (chapter) => `
                    <div class="preview-page">
                        <h2 class="chapter-title">${chapter.title}</h2>
                        ${chapter.pages.map((page) => page.content).join('<div style="margin: 2rem 0; border-top: 1px solid #e5e7eb;"></div>')}
                    </div>
                `,
                  )
                  .join('')}
            </div>
        </body>
        </html>
    `;

  previewWindow.document.write(previewHTML);
  previewWindow.document.close();
}

// =============================
// MODAL MANAGEMENT
// =============================

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('active');
  document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
document.addEventListener('click', function (event) {
  if (event.target.classList.contains('modal')) {
    closeModal(event.target.id);
  }
});

// =============================
// UTILITIES
// =============================

function logout() {
  if (
    confirm(
      'Are you sure you want to logout? Any unsaved changes will be lost.',
    )
  ) {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 2rem;
        background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 1rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        z-index: 3000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveBook();
  }
});
