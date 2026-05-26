const fs = require('fs');

let c = fs.readFileSync('src/components/InspetorDashboard.tsx', 'utf8');

c = c.split("${theme === 'light' ? 'text-[#003366]' : '${theme === \\'light\\' ? \\'text-[#003366]\\' : \\'").join("");
c = c.split("\\'}'}").join("");

// wait, the literal string in the file is:
// ${theme === 'light' ? 'text-[#003366]' : '${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'}'}
// because the outer is a template literal `... ${...} ...`
// and the inner one is just a literal string inside the JS expression!
// NO! It's:
// className={`text-sm ${theme === 'light' ? 'text-[#003366]' : '${theme === \'light\' ? \'text-[#003366]\' : \'text-gray-400\'}'} font-bold`}
// So the exact substring is:
// ${theme === 'light' ? 'text-[#003366]' : '${theme === \'light\' ? \'text-[#003366]\' : \'text-gray-400\'}'}

// Let's do a simple replace with exact matches for 400, 500, 600
for (let color of ['400', '500', '600']) {
  let bad = `\${theme === 'light' ? 'text-[#003366]' : '\${theme === \\'light\\' ? \\'text-[#003366]\\' : \\'text-gray-${color}\\'}'}`;
  let good = `\${theme === 'light' ? 'text-[#003366]' : 'text-gray-${color}'}`;
  c = c.split(bad).join(good);
}

fs.writeFileSync('src/components/InspetorDashboard.tsx', c);
console.log('Fixed exactly.');
