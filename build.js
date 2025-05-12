const fs = require('fs-extra');
const path = require('path');

// Define paths
const webDir = path.join(__dirname, 'web');
const publicDir = path.join(__dirname, 'public');

// Ensure the public directory exists and is empty
fs.emptyDirSync(publicDir);

// Copy all files from web directory to public directory
fs.copySync(webDir, publicDir);

console.log('Build completed! Files copied from web/ to public/'); 