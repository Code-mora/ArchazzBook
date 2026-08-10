const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting ArchazzBook build process...');

// Directories
const rootDir = __dirname;
const distDir = path.join(rootDir, 'public');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
  console.log('✅ Created public directory');
}

// Debug/test tooling must never be published: these pages expose internal data
// and destructive local-reset actions.
const EXCLUDED_FILES = new Set([
  'debug-books.html',
  'mobile-test.html',
  'reset-data.html',
  'test-stats.html',
  'START-HERE.html',
]);

// Helper function to copy files
function copyFiles(ext) {
  const files = fs
    .readdirSync(rootDir)
    .filter(file => file.endsWith(ext) && !EXCLUDED_FILES.has(file));
  files.forEach(file => {
    fs.copyFileSync(path.join(rootDir, file), path.join(distDir, file));
    console.log(`📋 Copied ${file}`);
  });
}

// Remove previously published debug pages that may still linger in the output folder
EXCLUDED_FILES.forEach(file => {
  const stalePath = path.join(distDir, file);
  if (fs.existsSync(stalePath)) {
    fs.rmSync(stalePath);
    console.log(`🧹 Removed excluded file from output: ${file}`);
  }
});

// 1. Copy HTML and CSS files directly
copyFiles('.html');
copyFiles('.css');

// Copy Service Worker explicitly (should not be obfuscated, must be in root)
if (fs.existsSync(path.join(rootDir, 'firebase-messaging-sw.js'))) {
  fs.copyFileSync(path.join(rootDir, 'firebase-messaging-sw.js'), path.join(distDir, 'firebase-messaging-sw.js'));
  console.log('📋 Copied firebase-messaging-sw.js');
}

// 2. Copy assets folder
const assetsDir = path.join(rootDir, 'assets');
if (fs.existsSync(assetsDir)) {
  const distAssetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(distAssetsDir)) {
    fs.mkdirSync(distAssetsDir);
  }
  // Use native cross-platform node API
  try {
    fs.cpSync(assetsDir, distAssetsDir, { recursive: true });
  } catch (e) {
    console.error('Failed to copy assets:', e);
  }
  console.log('🖼️ Copied assets folder');
}

// 3. Obfuscate JS files
const jsFiles = ['app.js', 'dashboard.js', 'writer.js', 'supabase-config.js', 'notifications.js'];

console.log('🔒 Starting JavaScript Obfuscation...');

jsFiles.forEach(file => {
  if (fs.existsSync(path.join(rootDir, file))) {
    try {
      console.log(`⏳ Obfuscating ${file}...`);
      // Use local binary to avoid npx prompt, and use lighter obfuscation settings to prevent OOM on Vercel
      execSync(`node ./node_modules/javascript-obfuscator/bin/javascript-obfuscator ${file} --output public/${file} --compact true`, { stdio: 'inherit' });
      console.log(`✅ Successfully obfuscated ${file}`);
    } catch (err) {
      console.error(`❌ Failed to obfuscate ${file}`, err);
      // Fallback: just copy it if obfuscation fails
      fs.copyFileSync(path.join(rootDir, file), path.join(distDir, file));
    }
  }
});

console.log('✨ Build process completed successfully! Output is in the "public" folder.');
