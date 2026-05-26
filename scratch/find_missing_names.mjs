import fs from 'fs';

const grades = JSON.parse(fs.readFileSync('parsed_grades_v2.json', 'utf8'));

console.log('Searching in parsed_grades_v2.json:');

const names = ['LUCAS', 'VINICIUS', 'FRÕES', 'JEFERSON'];
for (const n of names) {
  console.log(`\nMatches for "${n}":`);
  const matches = grades.filter(r => (r['Nome do Estudante'] || '').toUpperCase().includes(n));
  matches.forEach(m => console.log(`- ${m['Nome do Estudante']} (${m['Turma']})`));
}
