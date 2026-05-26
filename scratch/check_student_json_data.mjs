import fs from 'fs';

const grades = JSON.parse(fs.readFileSync('scratch/parsed_grades_v2.json', 'utf8'));

const lucas = grades.find(r => r['Nome do Estudante'] && r['Nome do Estudante'].includes('LUCAS JEFERSON'));
console.log('Lucas Jeferson Row:', lucas);

const vinicius = grades.find(r => r['Nome do Estudante'] && r['Nome do Estudante'].includes('VINICIUS FR'));
console.log('Vinicius Row:', vinicius);
