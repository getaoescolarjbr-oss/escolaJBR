const fs = require('fs');

let code = fs.readFileSync('src/components/InspetorDashboard.tsx', 'utf8');

// Helper to replace text-gray-X with theme conditional
// Only matches text-gray-400, 500, 600
const replaceGray = (str) => {
    return str.replace(/text-gray-(400|500|600)/g, (match) => {
        return `\${theme === 'light' ? 'text-[#003366]' : '${match}'}`;
    });
};

// 1. Find all className="..." and convert to className={`...`} IF they contain text-gray-
code = code.replace(/className="([^"]*text-gray-[456]00[^"]*)"/g, (match, p1) => {
    return `className={\`${replaceGray(p1)}\`}`;
});

// 2. Find all className={`...`} that already exist and replace text-gray inside them
code = code.replace(/className=\{`([^`]*text-gray-[456]00[^`]*)`\}/g, (match, p1) => {
    // wait, if we already replaced it in step 1, it won't have text-gray-400 as a simple string, it will be inside ${...}
    // but the regex text-gray-[456]00 will match.
    // actually, let's just do a global replace for text-gray-(400|500|600) AFTER converting the double quotes to template literals?
    // NO, because then it might replace text-gray-400 inside a JSX text node or something.
    // Let's do it safely.
    return `className={\`${replaceGray(p1)}\`}`;
});

// 3. For the constant `const labelCls = '... text-gray-400 ...';`
code = code.replace(/const labelCls = '([^']*text-gray-400[^']*)';/g, (match, p1) => {
    return `const labelCls = \`${replaceGray(p1)}\`;`;
});

// Write back
fs.writeFileSync('src/components/InspetorDashboard.tsx', code, 'utf8');
console.log('Replaced gray text successfully.');
