const fs = require('fs');
let c = fs.readFileSync('src/data/calendarData.ts', 'utf8');

c = c.replace(/"(\d{4}-\d{2}-\d{2})":\s*\{\s*"categoria": /g, (match, p1) => {
    return `"${p1}": { "data": "${p1}", "categoria": `;
});

fs.writeFileSync('src/data/calendarData.ts', c);
console.log('Fixed calendarData.ts with double quotes');
