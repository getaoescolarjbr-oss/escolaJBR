const fs = require('fs');
const file = 'src/components/StudentList.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/'avaliacoes_bimestrais'/g, "'avaliacoes'");
fs.writeFileSync(file, content);
console.log('Fixed StudentList.tsx');
