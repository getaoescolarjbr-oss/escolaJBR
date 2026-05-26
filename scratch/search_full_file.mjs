import fs from 'fs';

const content = fs.readFileSync('src/components/CoordinatorDashboard.tsx', 'utf8');
const lines = content.split('\n');
const terms = ['faltas', 'chamadas', 'chamada', 'frequencia', 'freq'];

console.log("Searching src/components/CoordinatorDashboard.tsx...");
lines.forEach((line, idx) => {
  terms.forEach(term => {
    if (line.toLowerCase().includes(term)) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
});
