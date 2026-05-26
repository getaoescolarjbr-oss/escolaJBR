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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('calendario_eventos') || content.includes('CalendarioLetivoModal') || content.includes('CalendarioEditor')) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  }
}

searchFiles(searchDir);
