import fs from 'fs';

const filePath = 'd:/ESCOLA/PROVAS/JBR - JOSÉ BARBOSA/2026/Gestão escolar/portal-professor-jbr/src/components/admin/AdminPanel.tsx';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('calendario_eventos') || line.includes('CalendarioLetivoModal') || line.includes('CalendarioEditor')) {
    console.log(`${index + 1}: ${line}`);
  }
});
