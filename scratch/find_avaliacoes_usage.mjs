import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory && f !== 'node_modules' && f !== '.git' && f !== 'dist') {
      walkDir(dirPath, callback);
    } else if (!isDirectory && (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.sql'))) {
      callback(dirPath);
    }
  });
}

walkDir('d:/ESCOLA/PROVAS/JBR - JOSÉ BARBOSA/2026/Gestão escolar/portal-professor-jbr/src', (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.toLowerCase().includes('avaliacoes') || content.toLowerCase().includes('avaliacao')) {
    console.log(`Match in: ${filePath}`);
  }
});
