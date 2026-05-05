const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting ArchazzBook build process...');

// Directories
const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
  console.log('✅ Created dist directory');
}

// Helper function to copy files
function copyFiles(ext) {
  const files = fs.readdirSync(rootDir).filter(file => file.endsWith(ext));
  files.forEach(file => {
    fs.copyFileSync(path.join(rootDir, file), path.join(distDir, file));
    console.log(`📋 Copied ${file}`);
  });
}

// 1. Copy HTML and CSS files directly
copyFiles('.html');
copyFiles('.css');

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
      // Run javascript-obfuscator using npx (will use local package if available)
      execSync(`npx javascript-obfuscator ${file} --output dist/${file} --compact true --control-flow-flattening true --dead-code-injection true`, { stdio: 'inherit' });
      console.log(`✅ Successfully obfuscated ${file}`);
    } catch (err) {
      console.error(`❌ Failed to obfuscate ${file}`, err);
      // Fallback: just copy it if obfuscation fails
      fs.copyFileSync(path.join(rootDir, file), path.join(distDir, file));
    }
  }
});

console.log('✨ Build process completed successfully! Output is in the "dist" folder.');
