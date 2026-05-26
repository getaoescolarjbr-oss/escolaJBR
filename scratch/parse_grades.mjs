import fs from 'fs';

function cleanString(str) {
    if (!str) return '';
    // replace any encoding issues if possible, or just trim
    // For keys, we might want to normalize
    return str.trim();
}

function parseJsonlInput(filePath) {
    if (!fs.existsSync(filePath)) return [];
    
    let content = fs.readFileSync(filePath, 'utf-8');
    // remove BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    
    let json;
    try {
        json = JSON.parse(content.trim());
    } catch (e) {
        console.log(`Error parsing JSON in ${filePath}:`, e.message);
        return [];
    }
    const text = json.content;
    
    // extract everything between <USER_REQUEST> and </USER_REQUEST>
    const startIdx = text.indexOf('<USER_REQUEST>');
    const endIdx = text.indexOf('</USER_REQUEST>');
    
    if (startIdx === -1 || endIdx === -1) return [];
    
    const payload = text.slice(startIdx + '<USER_REQUEST>'.length, endIdx);
    
    const lines = payload.split(/\r?\n/);
    const data = [];
    let currentHeaders = null;
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        const cols = line.split('\t');
        if (cols.length < 3) continue;
        
        // If it looks like a header row
        if (cols[0].includes('Turma') || cols[0].includes('Série')) {
            currentHeaders = cols.map(c => cleanString(c));
            // Force the first header to just be "Turma" for consistency
            currentHeaders[0] = 'Turma';
            continue;
        }
        
        // Data row
        if (currentHeaders && cols.length >= 2) {
            const row = {};
            for (let i = 0; i < currentHeaders.length; i++) {
                row[currentHeaders[i]] = cleanString(cols[i] || '');
            }
            data.push(row);
        }
    }
    return data;
}

const data6 = parseJsonlInput('scratch/step219.json');
const dataOthers = parseJsonlInput('scratch/step4.json');

const allData = [...data6, ...dataOthers];

console.log(`Total records: ${allData.length}`);

// group by Turma
const turmas = {};
for (const row of allData) {
    const turma = row['Turma'];
    if (!turma) {
        continue;
    }
    
    if (!turmas[turma]) turmas[turma] = 0;
    turmas[turma]++;
}

console.log(turmas);

if (allData.length > 0) {
    fs.writeFileSync('scratch/parsed_grades.json', JSON.stringify(allData, null, 2));
    console.log("Wrote parsed_grades.json");
}
