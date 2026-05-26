const fs = require('fs');
let c = fs.readFileSync('src/components/InspetorDashboard.tsx', 'utf8');

c = c.replace(/\$\{theme === 'light' \? 'text-\[\#003366\]' : '\\\$\\{theme === \\\\'light\\\\' \? \\\\'text-\\[#003366\\]\\\\' : \\\\'text-gray-400\\\\'\\}'\}/g, "${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'}");
c = c.replace(/\$\{theme === 'light' \? 'text-\[\#003366\]' : '\\\$\\{theme === \\\\'light\\\\' \? \\\\'text-\\[#003366\\]\\\\' : \\\\'text-gray-500\\\\'\\}'\}/g, "${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'}");
c = c.replace(/\$\{theme === 'light' \? 'text-\[\#003366\]' : '\\\$\\{theme === \\\\'light\\\\' \? \\\\'text-\\[#003366\\]\\\\' : \\\\'text-gray-600\\\\'\\}'\}/g, "${theme === 'light' ? 'text-[#003366]' : 'text-gray-600'}");

// Wait, the string in the file actually looks like this:
// ${theme === 'light' ? 'text-[#003366]' : '${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'}'}
// because the outer one is inside ` ... ` and the inner one is inside ' ... '
// Let's just fix it by downloading the file and doing replace_file_content! 
// Actually, I can just use a simple string replace for ALL occurrences.
let bad400 = "${theme === 'light' ? 'text-[#003366]' : '${theme === \\'light\\' ? \\'text-[#003366]\\' : \\'text-gray-400\\'}'}";
let bad500 = "${theme === 'light' ? 'text-[#003366]' : '${theme === \\'light\\' ? \\'text-[#003366]\\' : \\'text-gray-500\\'}'}";
let bad600 = "${theme === 'light' ? 'text-[#003366]' : '${theme === \\'light\\' ? \\'text-[#003366]\\' : \\'text-gray-600\\'}'}";

let good400 = "${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'}";
let good500 = "${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'}";
let good600 = "${theme === 'light' ? 'text-[#003366]' : 'text-gray-600'}";

c = c.split(bad400).join(good400);
c = c.split(bad500).join(good500);
c = c.split(bad600).join(good600);

// Wait, the inner string might NOT be escaped if it was processed differently.
// Let's also do the unescaped version just in case:
let bad400u = "${theme === 'light' ? 'text-[#003366]' : '${theme === 'light' ? 'text-[#003366]' : 'text-gray-400'}'}";
let bad500u = "${theme === 'light' ? 'text-[#003366]' : '${theme === 'light' ? 'text-[#003366]' : 'text-gray-500'}'}";
let bad600u = "${theme === 'light' ? 'text-[#003366]' : '${theme === 'light' ? 'text-[#003366]' : 'text-gray-600'}'}";

c = c.split(bad400u).join(good400);
c = c.split(bad500u).join(good500);
c = c.split(bad600u).join(good600);

fs.writeFileSync('src/components/InspetorDashboard.tsx', c);
console.log('Done!');
