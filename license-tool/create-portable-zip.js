/**
 * Create Portable Distribution Zip
 * 
 * Generates a clean `.zip` file from the Portable directory.
 * Uses `archiver` library which can handle long file paths
 * that would fail in Windows Explorer.
 * 
 * Usage: node create-portable-zip.js
 * Output: Doctor-Clinic-Portable.zip
 * 
 * The resulting zip contains relative paths, so the client
 * can extract it anywhere and double-click start.vbs.
 */

const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const rootDir = path.join(__dirname, '..');
const sourceDir = path.join(rootDir, 'Portable');
const outputPath = path.join(rootDir, 'Doctor-Clinic-Portable.zip');

// Check if source exists
if (!fs.existsSync(sourceDir)) {
  console.error('ERROR: Portable directory not found at:', sourceDir);
  process.exit(1);
}

// Create output stream
const output = fs.createWriteStream(outputPath);
const archive = new ZipArchive();
archive.pipe(output);

// Track progress
let totalFiles = 0;
let totalDirs = 0;

// Recursively add files with relative paths
function addDirectory(dirPath, relativePath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      // Skip .cache directory (prisma download cache - not needed)
      if (entry.name === '.cache') continue;
      
      totalDirs++;
      archive.append(null, { name: relPath + '/' });
      addDirectory(fullPath, relPath);
    } else if (entry.isFile()) {
      totalFiles++;
      const data = fs.readFileSync(fullPath);
      archive.append(data, { name: relPath });
    }
  }
}

console.log('📦 Creating Doctor-Clinic-Portable.zip...');
console.log(`   Source: ${sourceDir}`);
console.log('   Scanning files...');

addDirectory(sourceDir, '');

console.log(`   Found ${totalFiles} files in ${totalDirs} directories`);
console.log('   Compressing (this may take a minute)...');
console.log('');

archive.finalize();

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(1);
  console.log('✅ Doctor-Clinic-Portable.zip created!');
  console.log(`   Size: ${sizeMB} MB`);
  console.log(`   Path: ${outputPath}`);
  console.log('');
  console.log('Ready to send to the client.');
  console.log('The client extracts it and double-clicks start.vbs.');
});

archive.on('error', (err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
