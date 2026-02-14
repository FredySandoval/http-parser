import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { parseHttp } from '../../../src';
import { join, extname } from 'path';

const dirPath = process.argv[2];
const fileExtension = process.argv[3] || '.http';

if (!dirPath) {
  console.error('Usage: bun run ./test.ts <directory> [extension]');
  console.error('Example: bun run ./test.ts ./fixtures .http');
  process.exit(1);
}

const targetDir = join(process.cwd(), dirPath);

// Check if path is a directory
try {
  const stats = statSync(targetDir);
  if (!stats.isDirectory()) {
    console.error(`Error: ${dirPath} is not a directory`);
    process.exit(1);
  }
} catch (error) {
  console.error(`Error: Directory ${dirPath} not found`);
  process.exit(1);
}

// Get all files with the specified extension
const files = readdirSync(targetDir).filter(file => 
  extname(file) === fileExtension
);

if (files.length === 0) {
  console.log(`No ${fileExtension} files found in ${dirPath}`);
  process.exit(0);
}

console.log(`Found ${files.length} ${fileExtension} file(s) in ${dirPath}`);

// Process each file
files.forEach(file => {
  const filePath = join(targetDir, file);
  console.log(`\nProcessing: ${file}`);
  
  try {
    const input = readFileSync(filePath, 'utf-8');
    const result = parseHttp(input);
    
    console.dir(result, { depth: null });
    
    const outputPath = filePath.replace(new RegExp(`${fileExtension}$`), '.json');
    writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`✓ Generated: ${outputPath}`);
  } catch (error) {
    console.error(`✗ Error processing ${file}:`, error);
  }
});

console.log(`\nCompleted processing ${files.length} file(s)`);