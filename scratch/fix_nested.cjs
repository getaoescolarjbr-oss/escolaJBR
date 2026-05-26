const fs = require('fs');

let c = fs.readFileSync('src/components/InspetorDashboard.tsx', 'utf8');

c = c.replace(/\$\{theme === 'light' \? 'text-\[\#003366\]' : '\$\{theme === \\'light\\' \? \\'text-\\[#003366\\]\\' : \\'(.*?)\\'\\}'\}/g, "${theme === 'light' ? 'text-[#003366]' : '$1'}");

fs.writeFileSync('src/components/InspetorDashboard.tsx', c);
console.log('Fixed nested interpolations.');
