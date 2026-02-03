// =============================
// DASHBOARD INITIALIZATION
// =============================

let uploadedCover = null;
let quillEditor = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkDashboardAuth();
    
    // Initialize Quill Editor
    setTimeout(() => {
        // Register custom fonts
        const Font = Quill.import('formats/font');
        Font.whitelist = ['times-new-roman', 'arial', 'georgia', 'courier', 'verdana'];
        Quill.register(Font, true);
        
        quillEditor = new Quill('#story-editor', {
            theme: 'snow',
            placeholder: 'Write your story here... Use toolbar to format!',
            modules: {
                toolbar: [
                    [{ 'font': ['times-new-roman', 'arial', 'georgia', 'courier', 'verdana'] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'header': [1, 2, 3, false] }],
                    [{ 'size': ['small', false, 'large', 'huge'] }],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['blockquote', 'code-block'],
                    ['link'],
                    ['clean']
                ]
            }
        });
        
        // Set default font to Times New Roman
        quillEditor.format('font', 'times-new-roman');
        
        // Sync to hidden input
        quillEditor.on('text-change', () => {
            document.getElementById('book-story').value = quillEditor.root.innerHTML;
        });
    }, 100);
    
    // Load books
    loadDashboardBooks();
    
    // Update stats
    updateStats();
    
    // Hide upload form initially
    document.getElementById('upload-section').style.display = 'none';
});

// =============================
// AUTHENTICATION CHECK
// =============================

function checkDashboardAuth() {
    const savedUser = localStorage.getItem('currentUser');
    
    if (!savedUser) {
        // Not logged in, redirect to home
        window.location.href = 'index.html';
        return;
    }
    
    const user = JSON.parse(savedUser);
    
    if (user.role !== 'author') {
        // Not an author, redirect to home
        alert('Access denied. Author privileges required.');
        window.location.href = 'index.html';
        return;
    }
    
    // Update username in navbar
    document.getElementById('user-name').textContent = user.name;
}

// =============================
// BOOKS MANAGEMENT
// =============================

function loadDashboardBooks() {
    const savedBooks = localStorage.getItem('books');
    let books = [];
    
    if (savedBooks) {
        books = JSON.parse(savedBooks);
    } else {
        // Load from app.js if available
        books = window.ArchazzBook && window.ArchazzBook.books ? window.ArchazzBook.books : [];
        localStorage.setItem('books', JSON.stringify(books));
    }
    
    // Debug: log books being loaded
    console.log('Dashboard: Loading books:', books.length);
    console.log('Books:', books);
    
    const tbody = document.getElementById('books-table-body');
    tbody.innerHTML = '';
    
    if (books.length === 0) {
        // Check if mobile
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
    
    // Check if mobile view
    const isMobile = window.innerWidth <= 768;
    
    books.forEach(book => {
        if (isMobile) {
            // Mobile card layout
            const card = document.createElement('div');
            card.className = 'book-mobile-card';
            card.innerHTML = `
                <img src="${book.cover}" alt="${book.title}">
                <div class="book-mobile-info">
                    <h3>${book.title}</h3>
                    <div class="book-mobile-meta">
                        <span><i class="fas fa-book"></i> ${book.pages} pages</span>
                        <span><i class="fas fa-calendar"></i> ${formatDate(book.date)}</span>
                    </div>
                    <div class="book-mobile-actions">
                        <button class="btn btn-outline" onclick="window.location.href='writer.html?id=${book.id}'" style="flex: 1;">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger" onclick="deleteBook(${book.id})" style="flex: 1;">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            tbody.appendChild(card);
        } else {
            // Desktop table layout
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${book.cover}" alt="${book.title}" class="book-thumbnail"></td>
                <td><strong>${book.title}</strong></td>
                <td>${book.pages} pages</td>
                <td>${formatDate(book.date)}</td>
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
window.addEventListener('resize', function() {
    const currentWidth = window.innerWidth;
    // Only reload if crossing the 768px threshold
    if ((currentWidth <= 768 && !window.lastMobileState) || 
        (currentWidth > 768 && window.lastMobileState)) {
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
    
    // Get existing books
    const savedBooks = localStorage.getItem('books');
    let books = savedBooks ? JSON.parse(savedBooks) : [];
    
    // Create new book
    const newBook = {
        id: Date.now(),
        title: title,
        author: "Archazz",
        cover: uploadedCover,
        preview: preview,
        story: story,
        pages: pages,
        date: new Date().toISOString().split('T')[0]
    };
    
    // Add to books array
    books.push(newBook);
    
    // Save to localStorage
    localStorage.setItem('books', JSON.stringify(books));
    
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
    
    reader.onload = function(e) {
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

function deleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) {
        return;
    }
    
    // Get books
    const savedBooks = localStorage.getItem('books');
    let books = savedBooks ? JSON.parse(savedBooks) : [];
    
    // Remove book
    books = books.filter(b => b.id !== bookId);
    
    // Save
    localStorage.setItem('books', JSON.stringify(books));
    
    // Show notification
    showNotification('Book deleted successfully');
    
    // Reload
    loadDashboardBooks();
    updateStats();
}

function editBook(bookId) {
    // Get book
    const savedBooks = localStorage.getItem('books');
    let books = savedBooks ? JSON.parse(savedBooks) : [];
    const book = books.find(b => b.id === bookId);
    
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
    books = books.filter(b => b.id !== bookId);
    localStorage.setItem('books', JSON.stringify(books));
}

// =============================
// UI FUNCTIONS
// =============================

function showUploadForm() {
    document.getElementById('upload-section').style.display = 'block';
    document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth' });
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

function updateStats() {
    const savedBooks = localStorage.getItem('books');
    const books = savedBooks ? JSON.parse(savedBooks) : [];
    
    // Total Books - Real count
    const totalBooks = books.length;
    document.getElementById('total-books').textContent = totalBooks;
    
    // Total Views - Calculate based on books (simulate realistic views)
    let viewsData = localStorage.getItem('booksViews');
    let totalViews = 0;
    
    if (!viewsData) {
        // Initialize views for each book (random between 50-500 per book)
        const views = {};
        books.forEach(book => {
            views[book.id] = Math.floor(Math.random() * 450) + 50;
        });
        localStorage.setItem('booksViews', JSON.stringify(views));
        viewsData = JSON.stringify(views);
    }
    
    const views = JSON.parse(viewsData);
    totalViews = Object.values(views).reduce((sum, val) => sum + val, 0);
    document.getElementById('total-views').textContent = totalViews.toLocaleString();
    
    // Active Readers - Calculate as ~30-40% of total views
    const activeReaders = Math.floor(totalViews * (Math.random() * 0.1 + 0.3));
    document.getElementById('total-readers').textContent = activeReaders.toLocaleString();
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

// =============================
// UTILITIES
// =============================

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
