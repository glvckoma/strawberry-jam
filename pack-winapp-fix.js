const fs = require('fs');
const path = require('path');
const asar = require('asar');
const { execSync } = require('child_process');

console.log('Starting script to pack fixed winapp files into asar...');

// Define paths
const sourceDir = path.join(__dirname, 'assets', 'extracted-winapp-public');
const targetAsarPath = path.join(__dirname, 'assets', 'winapp.asar');
const backupAsarPath = path.join(__dirname, 'assets', 'winapp.asar.backup');

// Backup existing asar if it exists
if (fs.existsSync(targetAsarPath)) {
  console.log('Backing up existing winapp.asar...');
  fs.copyFileSync(targetAsarPath, backupAsarPath);
  console.log('Backup created at:', backupAsarPath);
}

// Create the asar archive
console.log('Creating new winapp.asar from fixed files...');
try {
  asar.createPackage(sourceDir, targetAsarPath)
    .then(() => {
      console.log('Successfully created new winapp.asar at:', targetAsarPath);
      
      // Output file size
      const stats = fs.statSync(targetAsarPath);
      console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      console.log('You should now update the app.asar in your build directory with this new file.');
      console.log('Done!');
    })
    .catch(err => {
      console.error('Error creating asar package:', err);
    });
} catch (error) {
  console.error('Error creating asar package:', error);
} 