import fs from 'fs';

const grades = JSON.parse(fs.readFileSync('scratch/parsed_grades_v2.json', 'utf8'));

const statusMap = {};
for (const row of grades) {
  const s = row['Situação'];
  statusMap[s] = (statusMap[s] || 0) + 1;
}

console.log('Situação distribution in spreadsheet:');
console.log(statusMap);

const nonAtivo = grades.filter(r => r['Situação'] !== 'Em curso');
console.log('\nNon "Em curso" students:');
for (const r of nonAtivo) {
  console.log(`  ${r['Turma']} | ${r['Nome do Estudante']} | ${r['Situação']}`);
}
