// =============================
// SHARED UTILITIES
// =============================
// Loaded before app.js / dashboard.js / writer.js and the inline reader script.
// Every helper is also exposed as a bare global so inline HTML handlers keep working.

(function () {
  const BOOKS_STORAGE_KEY = 'books';
  const PLACEHOLDER_COVER = 'https://via.placeholder.com/150x200?text=No+Cover';

  // =============================
  // LOCALSTORAGE
  // =============================

  function getBooksFromStorage() {
    try {
      const savedBooks = localStorage.getItem(BOOKS_STORAGE_KEY);
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

  function saveBooksToStorage(booksData) {
    try {
      localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(booksData));
      if (localStorage.getItem(BOOKS_STORAGE_KEY)) {
        console.log(
          '✅ Successfully saved ' + booksData.length + ' books to localStorage',
        );
        return true;
      }
      console.error('❌ Verification failed - data may not have been saved');
      return false;
    } catch (e) {
      console.error('❌ Error saving books to localStorage:', e);
      return false;
    }
  }

  // =============================
  // BOOK LOADING / FIELD NORMALIZATION
  // =============================

  // Load books from Supabase, falling back to localStorage when Supabase is
  // unavailable or errors out.
  async function fetchBooksWithFallback(context = 'Books') {
    if (window.SupabaseAPI) {
      try {
        console.log(`📚 ${context}: loading books from Supabase...`);
        const books = await window.SupabaseAPI.fetchBooks();
        console.log(`✅ ${context}: loaded ${books.length} books from Supabase`);
        return books;
      } catch (error) {
        console.error(`❌ ${context}: failed to load from Supabase:`, error);
      }
    }
    console.log(`📦 ${context}: loading books from localStorage...`);
    return getBooksFromStorage();
  }

  // Supabase and the legacy localStorage format use different field names.
  function getBookCover(book) {
    return (book && (book.cover_url || book.cover)) || PLACEHOLDER_COVER;
  }

  function getBookAuthor(book) {
    return (book && (book.author || book.author_name)) || 'Archazz';
  }

  function getBookDate(book) {
    return (
      (book && (book.created_at || book.date)) || new Date().toISOString()
    );
  }

  // Wait for supabase-config.js to publish window.SupabaseAPI.
  async function waitForSupabase(attempts = 10, intervalMs = 300) {
    for (let i = 0; i < attempts && !window.SupabaseAPI; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return !!window.SupabaseAPI;
  }

  // =============================
  // FORMATTING
  // =============================

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  function escapeHTML(str) {
    if (str === null || str === undefined || str === '') return '';
    return str.toString().replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const units = [
      [31536000, 'y'],
      [2592000, 'mo'],
      [86400, 'd'],
      [3600, 'h'],
      [60, 'm'],
    ];
    for (const [unitSeconds, label] of units) {
      const interval = seconds / unitSeconds;
      if (interval > 1) return Math.floor(interval) + label + ' ago';
    }
    return 'Just now';
  }

  // =============================
  // NOTIFICATIONS
  // =============================

  const NOTIFICATION_STYLE_ID = 'archazz-notification-animations';

  function injectNotificationStyles() {
    if (document.getElementById(NOTIFICATION_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = NOTIFICATION_STYLE_ID;
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function showNotification(message, options = {}) {
    const {
      position = 'top',
      duration = 3000,
      animationIn = 'slideInRight',
      animationOut = 'slideOutRight',
    } = options;

    injectNotificationStyles();

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        ${position === 'bottom' ? 'bottom: 2rem;' : 'top: 100px;'}
        right: 2rem;
        background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 1rem;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        z-index: 3000;
        animation: ${animationIn} 0.3s ease;
        max-width: 300px;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = `${animationOut} 0.3s ease`;
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // =============================
  // MODALS
  // =============================

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  // Close on backdrop click and on Escape, for every page.
  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('modal')) {
      closeModal(event.target.id);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) closeModal(activeModal.id);
  });

  // =============================
  // UI HELPERS
  // =============================

  // Markup for "no books"/"no results" placeholders.
  function emptyStateHTML({
    icon = 'fa-book',
    iconSize = '4rem',
    title,
    message,
    wrap = true,
  }) {
    const body = `
                <i class="fas ${icon}" style="font-size: ${iconSize}; color: var(--gray); margin-bottom: 1rem; display: block;"></i>
                ${title ? `<h3 style="font-size: 1.5rem; color: var(--dark); margin-bottom: 0.5rem;">${title}</h3>` : ''}
                <p style="color: var(--gray);">${message}</p>`;
    if (!wrap) return body;
    return `<div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">${body}</div>`;
  }

  function toggleMobileMenu() {
    const navLinks =
      document.getElementById('nav-links') ||
      document.querySelector('.nav-links');
    if (!navLinks) return;
    navLinks.classList.toggle('active');

    const icon = document.querySelector('.mobile-menu-btn i');
    if (!icon) return;
    const isOpen = navLinks.classList.contains('active');
    icon.classList.toggle('fa-bars', !isOpen);
    icon.classList.toggle('fa-times', isOpen);
  }

  // Read an image file as a base64 data URL, rejecting oversized files.
  function readImageFile(file, maxSizeMB = 5) {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`File size must be less than ${maxSizeMB}MB`);
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const ArchazzUtils = {
    PLACEHOLDER_COVER,
    getBooksFromStorage,
    saveBooksToStorage,
    fetchBooksWithFallback,
    getBookCover,
    getBookAuthor,
    getBookDate,
    waitForSupabase,
    formatDate,
    escapeHTML,
    stripHtml,
    formatTimeAgo,
    showNotification,
    openModal,
    closeModal,
    emptyStateHTML,
    toggleMobileMenu,
    readImageFile,
  };

  window.ArchazzUtils = ArchazzUtils;

  // Back-compat globals used by inline HTML handlers and page scripts.
  Object.assign(window, ArchazzUtils);
  window.escapeHtml = escapeHTML;
})();
