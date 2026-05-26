import fs from 'fs';

const content = fs.readFileSync('d:\\ESCOLA\\PROVAS\\JBR - JOSÉ BARBOSA\\2026\\Gestão escolar\\portal-professor-jbr\\src\\components\\StudentProfileModal.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 159; i <= 164; i++) {
  const line = lines[i];
  console.log(`Line ${i + 1}: [${line}]`);
  const codes = [];
  for (let j = 0; j < line.length; j++) {
    codes.push(line.charCodeAt(j));
  }
  console.log(`Codes ${i + 1}:`, codes.join(', '));
}
