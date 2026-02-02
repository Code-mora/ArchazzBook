# ArchazzBook - E-Book Platform

A beautiful, modern e-book platform with role-based access for authors and readers.

## 🌟 Features

### For Readers (Users)
- **Browse Books**: View all available e-books in a beautiful card-based layout
- **Book Previews**: See cover images and preview text before reading
- **Immersive Reading**: Full-screen reader with adjustable font size and dark/light mode
- **Reading Progress**: Visual progress bar while reading
- **Responsive Design**: Works perfectly on all devices

### For Authors (You)
- **Dashboard Access**: Manage all your books in one place
- **Upload Books**: Add new books with:
  - Custom cover images
  - Preview text
  - Full story content
  - Page count
- **Edit/Delete Books**: Full CRUD operations
- **Statistics**: Track total books and engagement

## 🚀 Getting Started

### 1. Open the Website
Simply open `index.html` in your web browser.

### 2. Author Login Credentials
To access the author dashboard:
- **Email**: `author@archazz.com`
- **Password**: `archazz2026`

> ⚠️ **IMPORTANT**: Change these credentials in `app.js` (lines 11-12) for security!

### 3. Regular User Access
Users can register with any email/password to browse and read books.

## 📁 File Structure

```
ARCHAZZ/
├── index.html          # Home page with book gallery
├── dashboard.html      # Author dashboard (protected)
├── reader.html         # Book reader page
├── styles.css          # Main stylesheet
├── app.js             # Main application logic
├── dashboard.js       # Dashboard functionality
├── assets/            # Images and media
└── README.md          # This file
```

## 🎨 Customization

### Change Author Credentials
Edit `app.js`:
```javascript
const AUTHOR_EMAIL = "your-email@example.com";
const AUTHOR_PASSWORD = "your-secure-password";
```

### Modify Color Scheme
Edit the CSS variables in `styles.css`:
```css
:root {
    --primary: #6366F1;
    --secondary: #EC4899;
    /* ... other colors */
}
```

### Add Initial Books
Edit the `books` array in `app.js` to include your default books.

## 📱 How to Use

### As an Author:

1. **Login**: Click "Login" and use author credentials
2. **Access Dashboard**: You'll be redirected to the dashboard
3. **Add New Book**:
   - Click "Add New Book"
   - Fill in the book details
   - Upload a cover image (PNG/JPG, max 5MB)
   - Write your preview and full story
   - Click "Publish Book"
4. **Manage Books**: Edit or delete existing books from the table

### As a Reader:

1. **Browse**: Scroll through the featured books on the home page
2. **View Details**: Click any book card to see full details
3. **Read**: Click "Read Now" (login required)
4. **Enjoy**: Use the reader controls:
   - Adjust font size
   - Toggle dark/light mode
   - Track reading progress

## 💾 Data Storage

Books and user data are stored in browser `localStorage`:
- **Books**: Stored as JSON array
- **Current User**: Session management
- **Persistent**: Data remains until browser cache is cleared

For production use, connect to a real backend database.

## 🎯 Features Highlights

### Premium Design
- Modern gradient backgrounds
- Smooth animations and transitions
- Glassmorphism effects
- Responsive grid layouts
- Professional typography (Outfit & Playfair Display)

### User Experience
- Intuitive navigation
- Mobile-friendly interface
- Loading states and notifications
- Form validation
- Keyboard shortcuts (ESC to close modals)

### Reading Experience
- Distraction-free reader
- Customizable font sizes
- Dark mode for night reading
- Reading progress indicator
- Smooth scrolling

## 🔧 Technical Details

- **Pure HTML/CSS/JavaScript**: No frameworks required
- **No Build Process**: Just open and run
- **LocalStorage API**: Client-side data persistence
- **FileReader API**: Image upload and preview
- **Responsive Design**: Mobile-first approach
- **Modern ES6+**: Clean, modern JavaScript

## 🌐 Browser Support

Works on all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## 📝 Future Enhancements

Consider adding:
- Backend API integration
- Real database (MySQL, MongoDB)
- User comments and ratings
- Bookmark functionality
- Reading history
- Search and filters
- Categories/genres
- Multi-chapter navigation
- Social sharing
- Download as PDF

## 🙏 Credits

Created with ❤️ for ArchazzBook
Designed for modern e-book publishing and reading

## 📄 License

Free to use and modify for personal and commercial projects.

---

**Enjoy sharing your stories with the world! 📚✨**
