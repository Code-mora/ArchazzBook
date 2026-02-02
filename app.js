// =============================
// DATA MANAGEMENT
// =============================

// Simulated database for books
// Start with empty array - author will upload books
let books = [];

// User authentication state
let currentUser = null;
const AUTHOR_EMAIL = "wazz"; // Author username
const AUTHOR_PASSWORD = "wazzhere"; // Author password

// =============================
// INITIALIZATION
// =============================

document.addEventListener('DOMContentLoaded', function() {
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
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUIForLoggedInUser();
    }
}

function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    // Check if author
    if (username === AUTHOR_EMAIL && password === AUTHOR_PASSWORD) {
        currentUser = {
            name: "Archazz",
            email: username,
            role: "author"
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForLoggedInUser();
        closeModal('login-modal');
        
        // Show success message
        showNotification('Welcome back, ' + currentUser.name + '!');
        
        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    } else {
        // Invalid credentials
        alert('Invalid author credentials. Please try again.');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    // Update UI
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-menu').style.display = 'none';
    
    showNotification('Logged out successfully');
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

// =============================
// BOOKS MANAGEMENT
// =============================

function loadBooks() {
    const booksGrid = document.getElementById('books-grid');
    booksGrid.innerHTML = '';
    
    // Get books from localStorage (same as dashboard)
    const savedBooks = localStorage.getItem('books');
    const books = savedBooks ? JSON.parse(savedBooks) : [];
    
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

function updateHeroStats(books) {
    // Update books count
    const booksCount = document.getElementById('books-count');
    if (booksCount) {
        booksCount.textContent = books.length;
    }
    
    // Calculate happy readers from views
    let viewsData = localStorage.getItem('booksViews');
    let totalReaders = 0;
    
    if (viewsData && books.length > 0) {
        const views = JSON.parse(viewsData);
        const totalViews = Object.values(views).reduce((sum, val) => sum + val, 0);
        // Calculate readers as 35% of total views (realistic engagement rate)
        totalReaders = Math.floor(totalViews * 0.35);
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
    
    card.innerHTML = `
        <div class="book-cover-container">
            <img src="${book.cover}" alt="${book.title}" loading="lazy">
        </div>
        <div class="book-info">
            <h3 class="book-title">${book.title}</h3>
            <p class="book-author">by ${book.author}</p>
            <p class="book-preview">${book.preview}</p>
            <div class="book-footer">
                <span class="book-date">
                    <i class="fas fa-calendar"></i> ${formatDate(book.date)}
                </span>
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
    const searchQuery = document.getElementById('book-search').value.toLowerCase();
    const selectedGenre = document.getElementById('genre-select').value.toLowerCase();
    const bookCards = document.querySelectorAll('.book-card');
    
    let visibleCount = 0;
    
    bookCards.forEach(card => {
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
            noResultsMsg.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 4rem 2rem;';
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

function showBookDetails(bookId) {
    // Get books from localStorage
    const savedBooks = localStorage.getItem('books');
    const books = savedBooks ? JSON.parse(savedBooks) : [];
    
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    
    document.getElementById('modal-book-cover').src = book.cover;
    document.getElementById('modal-book-title').textContent = book.title;
    document.getElementById('modal-book-author').textContent = book.author;
    document.getElementById('modal-book-date').textContent = formatDate(book.date);
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
document.addEventListener('click', function(event) {
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
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
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

document.addEventListener('keydown', function(event) {
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
    AUTHOR_EMAIL: AUTHOR_EMAIL,
    checkAuthState: checkAuthState,
    logout: logout,
    showNotification: showNotification,
    formatDate: formatDate
};
