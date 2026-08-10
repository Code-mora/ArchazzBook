// =============================
// DASHBOARD INITIALIZATION
// =============================

let uploadedCover = null;
let quillEditor = null;

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
  // These are async; surface rejections instead of leaving them unhandled
  checkDashboardAuth().catch((e) => console.error('❌ Auth check failed:', e));
  loadDashboardBooks().catch((e) => console.error('❌ Loading books failed:', e));
  updateStats().catch((e) => console.error('❌ Updating stats failed:', e));
});

// =============================
// AUTHENTICATION CHECK
// =============================

const AUTH_RETRY_LIMIT = 20; // ~10s at 500ms per attempt

async function checkDashboardAuth(attempt = 0) {
  if (!window.SupabaseAPI) {
    // Supabase not loaded yet, wait and retry — but give up eventually instead of
    // polling forever while the page silently shows an unauthenticated dashboard.
    if (attempt >= AUTH_RETRY_LIMIT) {
      console.error('❌ Supabase never became available; cannot verify session.');
      showNotification('Could not reach the server. Please reload the page.');
      return;
    }
    setTimeout(() => checkDashboardAuth(attempt + 1), 500);
    return;
  }

  let session;
  try {
    session = await window.SupabaseAPI.getSession();
  } catch (error) {
    // A failed lookup is not proof of being signed out — don't bounce the author
    // back to the home page on a transient network error.
    console.error('❌ Error verifying dashboard session:', error);
    showNotification('Could not verify your session. Please reload the page.');
    return;
  }

  if (!session || !session.user) {
    // Not logged in, redirect to home
    window.location.href = 'index.html';
    return;
  }

  // Valid Supabase session — update navbar
  document.getElementById('user-name').textContent = 'Archazz';
}

// =============================
// BOOKS MANAGEMENT
// =============================

async function loadDashboardBooks() {
  let books = [];
  let loadFailed = false;

  // Try Supabase first
  if (window.SupabaseAPI) {
    try {
      console.log('Dashboard: Loading books from Supabase...');
      books = await window.SupabaseAPI.fetchBooks();
      console.log('Dashboard: Loaded', books.length, 'books from Supabase');
    } catch (error) {
      console.error('Dashboard: Error loading from Supabase:', error);
      books = getBooksFromStorage();
      loadFailed = books.length === 0;
    }
  } else {
    books = getBooksFromStorage();
  }

  console.log('Books:', books);

  const tbody = document.getElementById('books-table-body');
  tbody.innerHTML = '';

  // Never render a failed load as "no books" — the author could publish a duplicate
  if (loadFailed) {
    const message = `
            <i class="fas fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
            <p>Could not load your books. Check your connection and try again.</p>
            <button class="btn btn-outline" style="margin-top: 1rem;" onclick="loadDashboardBooks()">Retry</button>
        `;
    tbody.innerHTML =
      window.innerWidth <= 768
        ? `<div style="text-align: center; padding: 2rem; color: var(--gray);">${message}</div>`
        : `<tr><td colspan="5" style="text-align: center; padding: 3rem; color: var(--gray);">${message}</td></tr>`;
    return;
  }

  if (books.length === 0) {
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      tbody.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--gray);">
                    <i class="fas fa-book" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    <p>No books yet. Start by adding your first book!</p>
                </div>
            `;
    } else {
      tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 3rem; color: var(--gray);">
                        <i class="fas fa-book" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                        <p>No books yet. Start by adding your first book!</p>
                    </td>
                </tr>
            `;
    }
    return;
  }

  const isMobile = window.innerWidth <= 768;

  books.forEach((book) => {
    // Use cover_url from Supabase or cover from localStorage
    const title = window.escapeHTML ? window.escapeHTML(book.title) : book.title;
    const rawCover = book.cover_url || book.cover || 'https://via.placeholder.com/150x200?text=No+Cover';
    const coverImage = window.escapeHTML ? window.escapeHTML(rawCover) : rawCover;
    const bookDate = book.created_at || book.date;

    // Determine status (default to 'published' for legacy books, 'draft' for new ones if no status)
    const status = book.status || 'published';
    const statusBadge = `
      <span style="
        font-size: 0.75rem; 
        padding: 0.25rem 0.6rem; 
        border-radius: 99px; 
        background: ${status === 'published' ? '#dcfce7' : '#f3f4f6'}; 
        color: ${status === 'published' ? '#166534' : '#4b5563'};
        font-weight: 600;
        border: 1px solid ${status === 'published' ? '#bbf7d0' : '#e5e7eb'};
        display: inline-block;
      ">
        ${status === 'published' ? 'PUBLISHED' : 'DRAFT'}
      </span>
    `;

    if (isMobile) {
      const card = document.createElement('div');
      card.className = 'book-mobile-card';
      // Inline styles for mobile card structure
      card.innerHTML = `
        <div style="display: flex; gap: 1rem;">
          <img src="${coverImage}" alt="${title}" style="width: 80px; height: 120px; object-fit: cover; border-radius: 6px; background: #f3f4f6;" onerror="this.src='https://via.placeholder.com/80x120?text=No+Cover'">
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
            <div style="margin-bottom: 0.5rem;">${statusBadge}</div>
            <h3 style="font-size: 1.125rem; font-weight: 700; margin: 0 0 0.25rem 0; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</h3>
            <div style="font-size: 0.875rem; color: #6b7280; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;">
               <span><i class="fas fa-book"></i> ${book.pages || 0} pages</span>
               <span><i class="fas fa-calendar"></i> ${formatDate(bookDate)}</span>
            </div>
          </div>
        </div>
        
        <div class="book-mobile-actions" style="display: flex; gap: 0.5rem; padding-top: 1rem; margin-top: 0.5rem; border-top: 1px solid #f3f4f6;">
            <button class="btn btn-outline" onclick="window.location.href='writer.html?id=${book.id}'" style="flex: 1; padding: 0.5rem; justify-content: center;">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-danger" onclick="deleteBook(${book.id})" style="flex: 1; padding: 0.5rem; justify-content: center;">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
      `;
      tbody.appendChild(card);
    } else {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><img src="${coverImage}" alt="${title}" class="book-thumbnail" onerror="this.src='https://via.placeholder.com/150x200?text=No+Cover'"></td>
        <td>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <strong style="font-size: 1rem;">${title}</strong>
                <div>${statusBadge}</div>
            </div>
        </td>
        <td>${book.pages || 0} pages</td>
        <td>${formatDate(bookDate)}</td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-icon btn-outline" onclick="window.location.href='writer.html?id=${book.id}'" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-icon btn-danger" onclick="deleteBook(${book.id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
      `;
      tbody.appendChild(row);
    }
  });
}

// Re-render on window resize
window.addEventListener('resize', function () {
  const currentWidth = window.innerWidth;
  // Only reload if crossing the 768px threshold
  if (
    (currentWidth <= 768 && !window.lastMobileState) ||
    (currentWidth > 768 && window.lastMobileState)
  ) {
    window.lastMobileState = currentWidth <= 768;
    loadDashboardBooks().catch((e) => console.error('❌ Loading books failed:', e));
  }
});

// Set initial state
window.lastMobileState = window.innerWidth <= 768;

function handleBookSubmit(event) {
  event.preventDefault();

  const title = document.getElementById('book-title').value;
  const preview = document.getElementById('book-preview').value;
  const story = document.getElementById('book-story').value;
  const pages = parseInt(document.getElementById('book-pages').value);

  if (!uploadedCover) {
    alert('Please upload a cover image');
    return;
  }

  // Get existing books using robust utility
  let books = getBooksFromStorage();

  // Create new book
  const newBook = {
    id: Date.now(),
    title: title,
    author: 'Archazz',
    cover: uploadedCover,
    preview: preview,
    story: story,
    pages: pages,
    date: new Date().toISOString().split('T')[0],
  };

  // Add to books array
  books.push(newBook);

  // Save to localStorage using robust utility
  if (!saveBooksToStorage(books)) {
    // Reporting success on a failed write loses the author's work silently
    showNotification('Failed to save the book. Your browser storage may be full.');
    return;
  }

  // Show success message
  showNotification('Book published successfully!');

  // Reset form
  document.getElementById('book-form').reset();
  uploadedCover = null;
  document.getElementById('cover-preview').style.display = 'none';
  document.getElementById('cover-upload').classList.remove('has-file');

  // Hide upload form
  toggleUploadForm();

  // Reload books
  loadDashboardBooks().catch((e) => console.error('❌ Loading books failed:', e));
  updateStats().catch((e) => console.error('❌ Updating stats failed:', e));
}

function handleCoverUpload(event) {
  const file = event.target.files[0];

  if (!file) return;

  // Check file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    alert('File size must be less than 5MB');
    return;
  }

  // Read file as base64
  const reader = new FileReader();

  reader.onerror = function () {
    console.error('❌ Error reading cover image:', reader.error);
    alert('Could not read that image file. Please try another one.');
  };

  reader.onload = function (e) {
    uploadedCover = e.target.result;

    // Show preview
    document.getElementById('preview-img').src = uploadedCover;
    document.getElementById('cover-preview').style.display = 'flex';

    // Update upload UI
    const uploadDiv = document.getElementById('cover-upload');
    uploadDiv.classList.add('has-file');
    uploadDiv.innerHTML = `
            <i class="fas fa-check-circle" style="color: #10B981;"></i>
            <p><strong>Cover uploaded successfully</strong></p>
            <p style="color: var(--gray); font-size: 0.875rem;">Click to change</p>
        `;
  };

  reader.readAsDataURL(file);
}

async function deleteBook(bookId) {
  if (!confirm('Are you sure you want to delete this book?')) {
    return;
  }

  try {
    // Delete from Supabase if available
    if (window.SupabaseAPI) {
      console.log('🗑️ Deleting book from Supabase...');
      await window.SupabaseAPI.deleteBook(bookId);
      console.log('✅ Book deleted from Supabase');
    }

    // Also remove from localStorage for backward compatibility
    let books = getBooksFromStorage();
    books = books.filter((b) => b.id !== bookId);
    if (!saveBooksToStorage(books)) {
      console.warn('⚠️ Book deleted remotely but the local cache could not be updated');
    }

    // Show notification
    showNotification('Book deleted successfully');

    // Reload
    await loadDashboardBooks();
    await updateStats();
  } catch (error) {
    console.error('❌ Error deleting book:', error);
    showNotification('Failed to delete book. Please try again.');
  }
}

function editBook(bookId) {
  // Get book using robust utility
  let books = getBooksFromStorage();
  const book = books.find((b) => b.id === bookId);

  if (!book) return;

  // Show upload form
  showUploadForm();

  // Fill form with book data
  document.getElementById('book-title').value = book.title;
  document.getElementById('book-preview').value = book.preview;
  document.getElementById('book-pages').value = book.pages;

  // Load story into Quill editor
  if (quillEditor) {
    quillEditor.root.innerHTML = book.story;
    document.getElementById('book-story').value = book.story;
  }

  // Set cover
  uploadedCover = book.cover;
  document.getElementById('preview-img').src = book.cover;
  document.getElementById('cover-preview').style.display = 'flex';
  document.getElementById('cover-upload').classList.add('has-file');

  // Delete the old book (will be replaced when form is submitted)
  books = books.filter((b) => b.id !== bookId);
  saveBooksToStorage(books);
}

// =============================
// UI FUNCTIONS
// =============================

function showUploadForm() {
  document.getElementById('upload-section').style.display = 'block';
  document
    .getElementById('upload-section')
    .scrollIntoView({ behavior: 'smooth' });
}

function toggleUploadForm() {
  const section = document.getElementById('upload-section');
  if (section.style.display === 'none') {
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
  } else {
    section.style.display = 'none';
    // Reset form
    document.getElementById('book-form').reset();
    uploadedCover = null;
    document.getElementById('cover-preview').style.display = 'none';
    document.getElementById('cover-upload').classList.remove('has-file');
    document.getElementById('cover-upload').innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <p><strong>Click to upload cover image</strong></p>
            <p style="color: var(--gray); font-size: 0.875rem;">PNG, JPG up to 5MB</p>
        `;
  }
}

async function updateStats() {
  let books = [];
  let statsAreStale = false;

  // Try Supabase first
  if (window.SupabaseAPI) {
    try {
      books = await window.SupabaseAPI.fetchBooks();
    } catch (error) {
      console.error('Error fetching books for stats:', error);
      books = getBooksFromStorage();
      statsAreStale = true;
    }
  } else {
    books = getBooksFromStorage();
  }

  if (statsAreStale) {
    showNotification('Showing cached stats — could not reach the server.');
  }

  // Total Books - Real count
  const totalBooks = books.length;
  document.getElementById('total-books').textContent = totalBooks;

  // Total Views - Calculate based on books (simulate realistic views)
  let viewsData = localStorage.getItem('booksViews');
  let totalViews = 0;

  if (!viewsData) {
    // Initialize views for each book (random between 50-500 per book)
    const views = {};
    books.forEach((book) => {
      views[book.id] = Math.floor(Math.random() * 450) + 50;
    });
    localStorage.setItem('booksViews', JSON.stringify(views));
    viewsData = JSON.stringify(views);
  }

  let views = {};
  try {
    views = JSON.parse(viewsData) || {};
  } catch (error) {
    // Corrupted cache should not blank out the whole stats panel
    console.error('❌ Corrupted booksViews in localStorage, resetting:', error);
    localStorage.removeItem('booksViews');
  }
  totalViews = Object.values(views).reduce((sum, val) => sum + val, 0);
  document.getElementById('total-views').textContent =
    totalViews.toLocaleString();

  // Active Readers - Calculate as ~30-40% of total views
  const activeReaders = Math.floor(totalViews * (Math.random() * 0.1 + 0.3));
  document.getElementById('total-readers').textContent =
    activeReaders.toLocaleString();
}

async function logout() {
  if (confirm('Are you sure you want to logout?')) {
    if (window.SupabaseAPI) {
      try {
        await window.SupabaseAPI.signOut();
      } catch (error) {
        // Local state is cleared either way, but the failure must be visible.
        console.error('❌ Error signing out:', error);
        alert('Signed out locally, but the server could not be reached.');
      }
    }
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  }
}

// =============================
// UTILITIES
// =============================

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

/* =============================
   MOBILE MENU TOGGLE
   ============================= */
function toggleMobileMenu() {
    const navLinks = document.getElementById('nav-links');
    navLinks.classList.toggle('active');
    
    // Animate icon
    const icon = document.querySelector('.mobile-menu-btn i');
    if (navLinks.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
}
// Make it global
window.toggleMobileMenu = toggleMobileMenu;

