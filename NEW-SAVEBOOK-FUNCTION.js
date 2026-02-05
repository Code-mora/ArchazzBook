// Paste function ini untuk replace saveBook() di writer.js (line 657-724)

async function saveBook() {
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

  // Show saving notification
  showNotification('Saving book...');

  try {
    let coverUrl = currentBook.cover; // Keep existing cover URL or base64

    // If cover is base64 and Supabase is available, upload to storage
    if (window.SupabaseAPI && currentBook.cover && currentBook.cover.startsWith('data:')) {
      try {
        console.log('📤 Uploading cover to Supabase Storage...');
        
        // Convert base64 to blob
        const response = await fetch(currentBook.cover);
        const blob = await response.blob();
        
        // Create file with unique name
        const fileName = `cover-${Date.now()}.${blob.type.split('/')[1]}`;
        const file = new File([blob], fileName, { type: blob.type });
        
        // Upload to Supabase Storage
        coverUrl = await window.SupabaseAPI.uploadCover(file, fileName);
        console.log('✅ Cover uploaded to Supabase:', coverUrl);
      } catch (uploadError) {
        console.error('⚠️ Failed to upload cover to Supabase:', uploadError);
        // Continue with base64 cover
      }
    }

    // Prepare book data for Supabase
    const bookData = {
      title: currentBook.title,
      author_name: currentBook.author || 'Archazz',
      genre: document.getElementById('book-genre').value || 'other',
      pages: totalPages,
      preview: generatePreview(),
      cover_url: coverUrl,
      chapters: currentBook.chapters, // Store as JSONB
    };

    let savedBook;

    // Save to Supabase if available
    if (window.SupabaseAPI) {
      if (isEditMode && editingBookId) {
        // Update existing book
        console.log('✏️ Updating book in Supabase...');
        savedBook = await window.SupabaseAPI.updateBook(editingBookId, bookData);
      } else {
        // Create new book
        console.log('📝 Creating new book in Supabase...');
        savedBook = await window.SupabaseAPI.createBook(bookData);
      }
      
      console.log('✅ Book saved to Supabase successfully');
    }

    // Also save to localStorage for backward compatibility
    const localStorageData = {
      ...currentBook,
      id: savedBook ? savedBook.id : (currentBook.id || Date.now()),
      title: currentBook.title,
      author: currentBook.author,
      genre: bookData.genre,
      date: savedBook ? savedBook.created_at : (currentBook.date || new Date().toISOString().split('T')[0]),
      pages: totalPages,
      preview: bookData.preview,
      cover: coverUrl,
    };

    let books = getBooksFromStorage();

    if (isEditMode && editingBookId) {
      const index = books.findIndex((b) => b.id === editingBookId);
      if (index !== -1) {
        books[index] = localStorageData;
      } else {
        books.push(localStorageData);
      }
    } else {
      books.push(localStorageData);
    }

    saveBooksToStorage(books);

    // Debug log
    console.log('Book saved:', localStorageData);
    console.log('Total books in storage:', books.length);

    // Show success
    showNotification('✅ Book published successfully!');

    // Redirect to dashboard after a moment
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);

  } catch (error) {
    console.error('❌ Error saving book:', error);
    showNotification('Failed to save book. Please try again.');
  }
}
