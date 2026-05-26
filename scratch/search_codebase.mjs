import fs from 'fs';
import path from 'path';

const searchDir = 'd:/ESCOLA/PROVAS/JBR - JOSÉ BARBOSA/2026/Gestão escolar/portal-professor-jbr/src';

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchFiles(fullPath);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('avaliacoes_bimestrais')) {
        console.log(`Found in: ${fullPath}`);
        // Let's print the line numbers and lines
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('avaliacoes_bimestrais')) {
            console.log(`  Line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchFiles(searchDir);
