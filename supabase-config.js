// =============================
// SUPABASE CONFIGURATION
// =============================

// Supabase Project Configuration
// Get anon key from: Supabase Dashboard > Settings > API > Publishable key
const SUPABASE_URL = 'https://ohruaeodmwbvhrcvrzgy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZZSa4WVVnt8fF60eDZwCA4w_2Dl0ypQ3';

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

// Export functions for use in other files
window.SupabaseAPI = {
  fetchBooks: fetchBooksFromSupabase,
  createBook: createBookInSupabase,
  updateBook: updateBookInSupabase,
  deleteBook: deleteBookFromSupabase,
  uploadCover: uploadCoverToSupabase,
  deleteCover: deleteCoverFromSupabase,
  incrementViews: incrementBookViews,
};
