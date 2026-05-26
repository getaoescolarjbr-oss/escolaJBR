import fs from 'fs';

const files = [
  'd:/ESCOLA/PROVAS/JBR - JOSÉ BARBOSA/2026/Gestão escolar/portal-professor-jbr/src/components/CoordinatorDashboard.tsx',
  'd:/ESCOLA/PROVAS/JBR - JOSÉ BARBOSA/2026/Gestão escolar/portal-professor-jbr/src/components/Dashboard.tsx',
  'd:/ESCOLA/PROVAS/JBR - JOSÉ BARBOSA/2026/Gestão escolar/portal-professor-jbr/src/components/LandingPage.tsx'
];

files.forEach(filePath => {
  console.log(`=== ${filePath} ===`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('calendario_eventos') || line.includes('CalendarioLetivoModal') || line.includes('CalendarioEditor')) {
      console.log(`${index + 1}: ${line}`);
    }
  });
});
