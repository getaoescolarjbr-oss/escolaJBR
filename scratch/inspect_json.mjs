import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/parsed_grades_v2.json', 'utf8'));
console.log('Total records:', data.length);
console.log('First record:', JSON.stringify(data[0], null, 2));

const allKeys = new Set();
data.forEach(row => {
  Object.keys(row).forEach(k => allKeys.add(k));
});
console.log('All unique headers/columns:', [...allKeys]);
