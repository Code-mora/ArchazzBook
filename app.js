// =============================
// DATA MANAGEMENT
// =============================

// Simulated database for books
// Start with empty array - author will upload books
let books = [];

// User authentication state
let currentUser = null;

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

// =============================
// INITIALIZATION
// =============================

document.addEventListener('DOMContentLoaded', function () {
  // Check for logged in user
  checkAuthState();

  // Load books
  loadBooks();

  // Setup event listeners
  setupEventListeners();

  // Generate about image
  generateAboutImage();
});

// =============================
// AUTHENTICATION
// =============================

function checkAuthState() {
  if (window.SupabaseAPI) {
    window.SupabaseAPI.getSession().then((session) => {
      if (session && session.user) {
        currentUser = {
          name: 'Archazz (Author)',
          email: session.user.email,
          role: 'author',
        };
        updateUIForLoggedInUser();
      } else {
        // Fallback to localStorage check for backward compatibility just in case, but clear it
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
           localStorage.removeItem('currentUser');
        }
      }
    });
  } else {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUIForLoggedInUser();
      }
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    if (window.SupabaseAPI) {
      // Use Supabase Auth
      const data = await window.SupabaseAPI.signIn(username, password);
      
      currentUser = {
        name: 'Archazz',
        email: data.user.email,
        role: 'author',
      };
      
      updateUIForLoggedInUser();
      closeModal('login-modal');

      // Show success message
      showNotification('Welcome back, ' + currentUser.name + '!');

      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
      
    } else {
      alert('Supabase is not initialized. Cannot login.');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Invalid author credentials. Please try again.');
  }
}

async function logout() {
  if (window.SupabaseAPI) {
    await window.SupabaseAPI.signOut();
  }
  
  currentUser = null;
  localStorage.removeItem('currentUser');

  // Update UI
  document.getElementById('auth-buttons').style.display = 'flex';
  document.getElementById('user-menu').style.display = 'none';

  showNotification('Logged out successfully');
  
  // If on dashboard, redirect to home
  if (window.location.pathname.includes('dashboard.html')) {
    window.location.href = 'index.html';
  }
}

function updateUIForLoggedInUser() {
  document.getElementById('auth-buttons').style.display = 'none';
  document.getElementById('user-menu').style.display = 'flex';
  document.getElementById('user-name').textContent = currentUser.name;

  // Show dashboard link for author
  if (currentUser.role === 'author') {
    const dashboardLink = document.getElementById('dashboard-link');
    dashboardLink.style.display = 'flex';
    dashboardLink.href = 'dashboard.html';
  }
}

// BOOKS MANAGEMENT
// =============================

async function loadBooks() {
  const booksGrid = document.getElementById('books-grid');
  if (!booksGrid) return;
  booksGrid.innerHTML = '';

  let books = [];

  // Try to load from Supabase first
  if (window.SupabaseAPI) {
    try {
      console.log('📚 Loading books from Supabase...');
      books = await window.SupabaseAPI.fetchBooks();
      console.log(`✅ Loaded ${books.length} books from Supabase`);
      
      // Filter for published books only
      // New books usually don't have a status or are 'published' by default if from localStorage logic fallback
      // But now we filter strictly for 'published' if the field exists
      books = books.filter(book => !book.status || book.status === 'published');
      console.log(`🔎 Filtered: ${books.length} published books`);

    } catch (error) {
      console.error('❌ Failed to load from Supabase:', error);
      // Fallback to localStorage
      console.log('⏳ Falling back to localStorage...');
      const savedBooks = getBooksFromStorage();
      books = savedBooks.length > 0 ? savedBooks : [];
    }
  } else {
    // Supabase not available, use localStorage
    console.log('📦 Loading books from localStorage...');
    const savedBooks = getBooksFromStorage();
    books = savedBooks.length > 0 ? savedBooks : [];
  }

  // Update hero stats
  updateHeroStats(books);

  // Show empty state if no books
  if (books.length === 0) {
    booksGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
                <i class="fas fa-book" style="font-size: 4rem; color: var(--gray); margin-bottom: 1rem; display: block;"></i>
                <h3 style="font-size: 1.5rem; color: var(--dark); margin-bottom: 0.5rem;">No Books Yet</h3>
                <p style="color: var(--gray);">Books will appear here once the author uploads them.</p>
            </div>
        `;
    return;
  }

  books.forEach((book, index) => {
    const bookCard = createBookCard(book);
    bookCard.style.animationDelay = `${index * 0.1}s`;
    bookCard.classList.add('fade-in');
    booksGrid.appendChild(bookCard);
  });
}

async function updateHeroStats(books) {
  // Update books count
  const booksCount = document.getElementById('books-count');
  if (booksCount) {
    booksCount.textContent = books.length;
  }

  // Ambil jumlah "Happy Readers" yang NYATA dari tabel reactions di Supabase
  let totalReaders = 0;
  if (window.SupabaseAPI && window.SupabaseAPI.countHappyReaders) {
    try {
      totalReaders = await window.SupabaseAPI.countHappyReaders();
    } catch (e) {
      console.warn('Could not fetch happy readers count:', e);
    }
  }

  // Update readers count with animation
  const readersCount = document.getElementById('readers-count');
  if (readersCount) {
    animateNumber(readersCount, 0, totalReaders, 1000);
  }
}

function animateNumber(element, from, to, duration) {
  const start = Date.now();
  const range = to - from;

  function update() {
    const now = Date.now();
    const progress = Math.min((now - start) / duration, 1);
    const current = Math.floor(from + range * progress);
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  update();
}

function createBookCard(book) {
  const card = document.createElement('div');
  card.className = 'book-card';
  card.onclick = () => showBookDetails(book.id);

  // Store genre for filtering (default to 'other' if not set)
  card.dataset.genre = (book.genre || 'other').toLowerCase();
  card.dataset.title = book.title.toLowerCase();

    // Handle legacy vs Supabase fields
    const authorName = book.author || book.author_name || 'Archazz';
    const dateValue = book.date || book.created_at || new Date().toISOString();
    const genre = book.genre || 'General';
    const pages = book.pages || '?';
    const coverImage = book.cover_url || book.cover || 'https://via.placeholder.com/150x200?text=No+Cover';
    
    card.innerHTML = `
        <div class="book-cover-container">
            <img src="${coverImage}" alt="${book.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/150x200?text=No+Cover'">
            <span class="genre-badge">${genre}</span>
        </div>
        <div class="book-info">
            <h3 class="book-title">${book.title}</h3>
            <p class="book-author">by ${authorName}</p>
            <p class="book-preview">${book.preview}</p>
            <div class="book-footer">
                <div class="book-meta">
                    <span class="book-pages" title="Pages">
                        <i class="fas fa-file-alt"></i> ${pages}
                    </span>
                    <span class="book-date">
                        <i class="fas fa-calendar"></i> ${formatDate(dateValue)}
                    </span>
                </div>
                <button class="btn btn-primary" onclick="event.stopPropagation(); showBookDetails(${book.id})">
                    <i class="fas fa-book-reader"></i> Read
                </button>
            </div>
        </div>
    `;

  return card;
}

// Filter books by search query and genre
function filterBooks() {
  const searchQuery = document
    .getElementById('book-search')
    .value.toLowerCase();
  const selectedGenre = document
    .getElementById('genre-select')
    .value.toLowerCase();
  const bookCards = document.querySelectorAll('.book-card');

  let visibleCount = 0;

  bookCards.forEach((card) => {
    const title = card.dataset.title;
    const genre = card.dataset.genre;

    const matchesSearch = title.includes(searchQuery);
    const matchesGenre = selectedGenre === 'all' || genre === selectedGenre;

    if (matchesSearch && matchesGenre) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  // Show "no results" message if no books match
  const booksGrid = document.getElementById('books-grid');
  let noResultsMsg = document.getElementById('no-results-message');

  if (visibleCount === 0 && bookCards.length > 0) {
    if (!noResultsMsg) {
      noResultsMsg = document.createElement('div');
      noResultsMsg.id = 'no-results-message';
      noResultsMsg.style.cssText =
        'grid-column: 1/-1; text-align: center; padding: 4rem 2rem;';
      noResultsMsg.innerHTML = `
                <i class="fas fa-search" style="font-size: 4rem; color: var(--gray); margin-bottom: 1rem; display: block;"></i>
                <h3 style="font-size: 1.5rem; color: var(--dark); margin-bottom: 0.5rem;">No Books Found</h3>
                <p style="color: var(--gray);">Try adjusting your search or filter criteria.</p>
            `;
      booksGrid.appendChild(noResultsMsg);
    }
  } else if (noResultsMsg) {
    noResultsMsg.remove();
  }
}

async function showBookDetails(bookId) {
  let books = [];

  // Try Supabase first
  if (window.SupabaseAPI) {
    try {
      books = await window.SupabaseAPI.fetchBooks();
    } catch (error) {
      console.error('Error fetching from Supabase:', error);
      books = getBooksFromStorage();
    }
  } else {
    books = getBooksFromStorage();
  }

  const book = books.find((b) => b.id === bookId);
  if (!book) return;

  const coverImage = book.cover_url || book.cover || 'https://via.placeholder.com/150x200?text=No+Cover';
  document.getElementById('modal-book-cover').src = coverImage;
  document.getElementById('modal-book-title').textContent = book.title;
  document.getElementById('modal-book-author').textContent =
    book.author_name || book.author || 'Archazz';
  
  const dateValue = book.created_at || book.date || new Date().toISOString();
  document.getElementById('modal-book-date').textContent = formatDate(dateValue);
  document.getElementById('modal-book-pages').textContent = book.pages;
  document.getElementById('modal-book-preview').textContent = book.preview;

  // Store current book ID for reading
  document.getElementById('book-modal').dataset.bookId = bookId;

  openModal('book-modal');
}

function readBook() {
  const bookId = document.getElementById('book-modal').dataset.bookId;
  window.location.href = `reader.html?id=${bookId}`;
}

// =============================
// MODAL MANAGEMENT
// =============================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('active');
  document.body.style.overflow = 'auto';
}

function showLoginModal() {
  openModal('login-modal');
}

function showRegisterModal() {
  // Registration removed - redirect to login
  showLoginModal();
}

function switchToRegister() {
  // Registration removed - do nothing
}

function switchToLogin() {
  // Just close any modals and show login
  closeModal('register-modal');
  openModal('login-modal');
}

// Close modal when clicking outside
document.addEventListener('click', function (event) {
  if (event.target.classList.contains('modal')) {
    closeModal(event.target.id);
  }
});

// =============================
// UI UTILITIES
// =============================

function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  navLinks.classList.toggle('active');
}

function scrollToBooks() {
  document.getElementById('featured').scrollIntoView({ behavior: 'smooth' });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function showNotification(message) {
  // Create notification element
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

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function setupEventListeners() {
  // Navbar scroll effect
  window.addEventListener('scroll', function () {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Smooth scroll for navigation links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Close mobile menu if open
        const navLinks = document.querySelector('.nav-links');
        navLinks.classList.remove('active');
      }
    });
  });

  // Setup dropdown toggle for mobile/touch reliability
  document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const dropdown = this.closest('.dropdown');
      // Toggle active class
      dropdown.classList.toggle('active');
      
      // Close other active dropdowns if any exist
      document.querySelectorAll('.dropdown.active').forEach(other => {
        if (other !== dropdown) other.classList.remove('active');
      });
    });
  });

  // Close dropdowns when clicking anywhere else
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown.active').forEach(dropdown => {
        dropdown.classList.remove('active');
      });
    }
  });
}

function generateAboutImage() {
  // Create a placeholder for the about image
  const aboutImg = document.getElementById('about-img');
  if (aboutImg) {
    aboutImg.src = 'https://picsum.photos/600/400?random=100';
    aboutImg.alt = 'Reading and storytelling';
  }
}

// =============================
// KEYBOARD SHORTCUTS
// =============================

document.addEventListener('keydown', function (event) {
  // ESC to close modals
  if (event.key === 'Escape') {
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      closeModal(activeModal.id);
    }
  }
});

// =============================
// EXPORT FOR OTHER PAGES
// =============================

// Make functions available globally for dashboard and reader pages
window.ArchazzBook = {
  books: books,
  currentUser: currentUser,
  checkAuthState: checkAuthState,
  logout: logout,
  showNotification: showNotification,
  formatDate: formatDate,
};
