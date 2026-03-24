// =============================
// SUPABASE CONFIGURATION
// =============================

// Supabase Project Configuration
// Get anon key from: Supabase Dashboard > Settings > API > Publishable key
const SUPABASE_URL = 'https://ohruaeodmwbvhrcvrzgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnVhZW9kbXdidmhyY3Zyemd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzY0MDAsImV4cCI6MjA4NTg1MjQwMH0.e9SE-3gE9qfWbde-QD5gWR0VLUKF7PDgKg-0I3Uk5ys';

// Initialize Supabase client on window object (avoid any local variable conflicts)
if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase client initialized');
}

// Storage bucket name for book covers
const BOOK_COVERS_BUCKET = 'book-covers';

// =============================
// SUPABASE API FUNCTIONS
// =============================

/**
 * Fetch all books from Supabase
 * @returns {Promise<Array>} Array of books
 */
async function fetchBooksFromSupabase() {
  try {
    console.log('📚 Fetching books from Supabase...');
    
    const { data, error } = await window.supabaseClient
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`✅ Retrieved ${data.length} books from Supabase`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching books:', error);
    return [];
  }
}

/**
 * Create a new book in Supabase
 * @param {Object} bookData - Book data to insert
 * @returns {Promise<Object>} Created book
 */
async function createBookInSupabase(bookData) {
  try {
    console.log('📝 Creating book in Supabase:', bookData.title);

    const { data, error } = await window.supabaseClient
      .from('books')
      .insert([bookData])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Book created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error creating book:', error);
    throw error;
  }
}

/**
 * Update an existing book in Supabase
 * @param {number} bookId - Book ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated book
 */
async function updateBookInSupabase(bookId, updates) {
  try {
    console.log('✏️ Updating book in Supabase:', bookId);

    const { data, error } = await window.supabaseClient
      .from('books')
      .update(updates)
      .eq('id', bookId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Book updated successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Error updating book:', error);
    throw error;
  }
}

/**
 * Delete a book from Supabase
 * @param {number} bookId - Book ID to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteBookFromSupabase(bookId) {
  try {
    console.log('🗑️ Deleting book from Supabase:', bookId);

    const { error } = await window.supabaseClient.from('books').delete().eq('id', bookId);

    if (error) throw error;

    console.log('✅ Book deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Error deleting book:', error);
    throw error;
  }
}

/**
 * Upload book cover to Supabase Storage
 * @param {File} file - Image file
 * @param {string} fileName - Unique file name
 * @returns {Promise<string>} Public URL of uploaded image
 */
async function uploadCoverToSupabase(file, fileName) {
  try {
    console.log('📤 Uploading cover to Supabase:', fileName);

    // Upload file to storage
    const { data, error } = await window.supabaseClient.storage
      .from(BOOK_COVERS_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const {
      data: { publicUrl },
    } = window.supabaseClient.storage.from(BOOK_COVERS_BUCKET).getPublicUrl(fileName);

    console.log('✅ Cover uploaded successfully:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ Error uploading cover:', error);
    throw error;
  }
}

/**
 * Delete book cover from Supabase Storage
 * @param {string} fileName - File name to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteCoverFromSupabase(fileName) {
  try {
    console.log('🗑️ Deleting cover from Supabase:', fileName);

    const { error } = await window.supabaseClient.storage
      .from(BOOK_COVERS_BUCKET)
      .remove([fileName]);

    if (error) throw error;

    console.log('✅ Cover deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Error deleting cover:', error);
    return false;
  }
}

/**
 * Increment book views
 * @param {number} bookId - Book ID
 * @returns {Promise<boolean>} Success status
 */
async function incrementBookViews(bookId) {
  try {
    // First get current views
    const { data: book, error: fetchError } = await window.supabaseClient
      .from('books')
      .select('views')
      .eq('id', bookId)
      .single();

    if (fetchError) throw fetchError;

    // Increment views
    const { error: updateError } = await window.supabaseClient
      .from('books')
      .update({ views: (book.views || 0) + 1 })
      .eq('id', bookId);

    if (updateError) throw updateError;

    return true;
  } catch (error) {
    console.error('❌ Error incrementing views:', error);
    return false;
  }
}

/**
 * Fetch comments for a book from Supabase
 * @param {number} bookId - Book ID
 * @param {number} chapterId - Target Chapter ID (Optional)
 * @returns {Promise<Array>} Array of comments
 */
async function fetchComments(bookId, chapterId = null) {
  try {
    let query = window.supabaseClient
      .from('comments')
      .select('*')
      .eq('book_id', bookId);
      
    // Filter chapter-spesifik jika dimintakan
    if (chapterId !== null) {
        query = query.eq('chapter_id', chapterId);
    } else {
        // Untuk backward compatibility buku-buku lama atau cover utama:
        // query = query.filter('chapter_id', 'is', 'null'); ATAU dibiarkan load semua.
        // Kita biarkan select semua jika chapterId tidak disebut.
    }
      
    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    return [];
  }
}

/**
 * Create a new comment in Supabase
 * @param {Object} commentData - Comment data
 * @returns {Promise<Object>} Created comment
 */
async function createComment(commentData) {
  try {
    const { data, error } = await window.supabaseClient
      .from('comments')
      .insert([commentData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error creating comment:', error);
    throw error;
  }
}

/**
 * Delete a comment
 * @param {number} commentId
 * @returns {Promise<boolean>}
 */
async function deleteComment(commentId) {
  try {
    const { error } = await window.supabaseClient
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    return false;
  }
}

/**
 * Update a comment
 * @param {number} commentId
 * @param {string} newContent
 * @returns {Promise<boolean>}
 */
async function updateComment(commentId, newContent) {
  try {
    const { error } = await window.supabaseClient
      .from('comments')
      .update({ content: newContent })
      .eq('id', commentId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error updating comment:', error);
    return false;
  }
}


/**
 * Tambahkan emoji reaction ke suatu chapter/buku
 */
async function addReaction(bookId, chapterId, browserId, emoji) {
  try {
    const { data, error } = await window.supabaseClient
      .from('reactions')
      .upsert([{ book_id: bookId, chapter_id: chapterId, browser_id: browserId, emoji }], {
        onConflict: 'book_id,chapter_id,browser_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error adding reaction:', error);
    throw error;
  }
}

/**
 * Hapus reaction (toggle off)
 */
async function deleteReaction(bookId, chapterId, browserId) {
  try {
    const { error } = await window.supabaseClient
      .from('reactions')
      .delete()
      .eq('book_id', bookId)
      .eq('browser_id', browserId)
      .is('chapter_id', chapterId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error deleting reaction:', error);
    return false;
  }
}

/**
 * Ambil semua reaction untuk suatu chapter/buku
 */
async function fetchReactions(bookId, chapterId = null) {
  try {
    let query = window.supabaseClient
      .from('reactions')
      .select('emoji, browser_id')
      .eq('book_id', bookId);

    if (chapterId !== null) {
      query = query.eq('chapter_id', chapterId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching reactions:', error);
    return [];
  }
}

/**
 * Ambil total "Happy Readers" global = jumlah unique browser_id yang pernah react
 */
async function countHappyReaders() {
  try {
    const { count, error } = await window.supabaseClient
      .from('reactions')
      .select('browser_id', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('❌ Error counting happy readers:', error);
    return 0;
  }
}

// Export functions for use in other files
window.SupabaseAPI = {
  fetchBooks: fetchBooksFromSupabase,
  createBook: createBookInSupabase,
  updateBook: updateBookInSupabase,
  deleteBook: deleteBookFromSupabase,
  uploadCover: uploadCoverToSupabase,
  deleteCover: deleteCoverFromSupabase,
  incrementViews: incrementBookViews,
  fetchComments: fetchComments,
  createComment: createComment,
  deleteComment: deleteComment,
  updateComment: updateComment,
  addReaction: addReaction,
  deleteReaction: deleteReaction,
  fetchReactions: fetchReactions,
  countHappyReaders: countHappyReaders,
};
