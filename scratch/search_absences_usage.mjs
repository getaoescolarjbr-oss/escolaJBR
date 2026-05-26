import fs from 'fs';
import path from 'path';

const srcDir = 'src';
const terms = [/chamada/i, /falta/i, /frequencia/i];

function searchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileBasename = path.basename(filePath);
  
  lines.forEach((line, idx) => {
    terms.forEach(regex => {
      if (regex.test(line)) {
        console.log(`[${fileBasename}:${idx + 1}] ${line.trim()}`);
      }
    });
  });
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      traverse(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      searchFile(fullPath);
    }
  });
}

console.log("Searching for references...");
traverse(srcDir);
