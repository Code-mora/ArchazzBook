// =============================
// DASHBOARD INITIALIZATION
// =============================

let uploadedCover = null;
let quillEditor = null;

// Shared helpers (getBooksFromStorage, formatDate, showNotification, ...) live
// in shared-utils.js and are exposed as globals.

document.addEventListener('DOMContentLoaded', function () {
  // Check authentication
  checkDashboardAuth();

  // Load books
  loadDashboardBooks();

  // Update stats
  updateStats();
});

// =============================
// AUTHENTICATION CHECK
// =============================

async function checkDashboardAuth() {
  if (!(await waitForSupabase())) {
    console.error('Supabase not loaded, redirecting...');
    window.location.href = 'index.html';
    return;
  }

  const session = await window.SupabaseAPI.getSession();

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
  const books = await fetchBooksWithFallback('Dashboard');

  const tbody = document.getElementById('books-table-body');
  tbody.innerHTML = '';

  if (books.length === 0) {
    const isMobile = window.innerWidth <= 768;

    const emptyBody = emptyStateHTML({
      iconSize: '3rem',
      message: 'No books yet. Start by adding your first book!',
      wrap: false,
    });

    tbody.innerHTML = isMobile
      ? `<div style="text-align: center; padding: 2rem; color: var(--gray);">${emptyBody}</div>`
      : `<tr><td colspan="5" style="text-align: center; padding: 3rem; color: var(--gray);">${emptyBody}</td></tr>`;
    return;
  }

  const isMobile = window.innerWidth <= 768;

  books.forEach((book) => {
    // Use cover_url from Supabase or cover from localStorage
    const title = escapeHTML(book.title);
    const coverImage = escapeHTML(getBookCover(book));
    const bookDate = getBookDate(book);

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
        <td><img src="${coverImage}" alt="${title}" class="book-thumbnail" onerror="this.src='${PLACEHOLDER_COVER}'"></td>
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
    loadDashboardBooks();
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
  saveBooksToStorage(books);

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
  loadDashboardBooks();
  updateStats();
}

async function handleCoverUpload(event) {
  const dataUrl = await readImageFile(event.target.files[0]);
  if (!dataUrl) return;

  uploadedCover = dataUrl;

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
    saveBooksToStorage(books);

    // Show notification
    showNotification('Book deleted successfully');

    // Reload
    await loadDashboardBooks();
    updateStats();
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
  const books = await fetchBooksWithFallback('Stats');

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

  const views = JSON.parse(viewsData);
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
      await window.SupabaseAPI.signOut();
    }
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  }
}


