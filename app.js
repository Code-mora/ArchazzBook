// =============================
// DATA MANAGEMENT
// =============================

// Simulated database for books
// Start with empty array - author will upload books
let books = [];

// User authentication state
let currentUser = null;

// Shared helpers (getBooksFromStorage, formatDate, showNotification, modals, ...)
// live in shared-utils.js and are exposed as globals.

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
        // Clear any leftover insecure local storage
        localStorage.removeItem('currentUser');
      }
    });
  } else {
    console.warn("Supabase API not available, authentication skipped.");
    // Clear any insecure fallback
    localStorage.removeItem('currentUser');
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

  let books = await fetchBooksWithFallback('Home');

  // Only published books are listed (legacy books have no status field)
  books = books.filter((book) => !book.status || book.status === 'published');
  console.log(`🔎 Filtered: ${books.length} published books`);

  // Update hero stats
  updateHeroStats(books);

  // Show empty state if no books
  if (books.length === 0) {
    booksGrid.innerHTML = emptyStateHTML({
      title: 'No Books Yet',
      message: 'Books will appear here once the author uploads them.',
    });
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
  card.dataset.title = escapeHTML(book.title).toLowerCase();

    // Handle legacy vs Supabase fields
    const authorName = escapeHTML(getBookAuthor(book));
    const dateValue = getBookDate(book);
    const genre = escapeHTML(book.genre || 'General');
    const pages = escapeHTML(book.pages || '?');
    const title = escapeHTML(book.title);
    const preview = escapeHTML(book.preview);
    const coverImage = escapeHTML(getBookCover(book));
    
    card.innerHTML = `
        <div class="book-cover-container">
            <img src="${coverImage}" alt="${title}" loading="lazy" onerror="this.src='${PLACEHOLDER_COVER}'">
            <span class="genre-badge">${genre}</span>
        </div>
        <div class="book-info">
            <h3 class="book-title">${title}</h3>
            <p class="book-author">by ${authorName}</p>
            <p class="book-preview">${preview}</p>
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
      noResultsMsg.innerHTML = emptyStateHTML({
        icon: 'fa-search',
        title: 'No Books Found',
        message: 'Try adjusting your search or filter criteria.',
        wrap: false,
      });
      booksGrid.appendChild(noResultsMsg);
    }
  } else if (noResultsMsg) {
    noResultsMsg.remove();
  }
}

async function showBookDetails(bookId) {
  const books = await fetchBooksWithFallback('Book details');

  const book = books.find((b) => b.id === bookId);
  if (!book) return;

  document.getElementById('modal-book-cover').src = getBookCover(book);
  document.getElementById('modal-book-title').textContent = book.title;
  document.getElementById('modal-book-author').textContent = getBookAuthor(book);

  document.getElementById('modal-book-date').textContent = formatDate(
    getBookDate(book),
  );
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

// =============================
// UI UTILITIES
// =============================

function scrollToBooks() {
  document.getElementById('featured').scrollIntoView({ behavior: 'smooth' });
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
