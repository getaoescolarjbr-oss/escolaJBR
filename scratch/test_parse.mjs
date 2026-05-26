import fs from 'fs';

function cleanString(str) {
    if (!str) return '';
    return str.trim();
}

function parseJsonlInput(filePath) {
    if (!fs.existsSync(filePath)) return [];
    
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    
    let json;
    try {
        json = JSON.parse(content.trim());
    } catch (e) {
        return [];
    }
    const text = json.content;
    
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
        
        if (cols[0].includes('Turma') || cols[0].includes('Série')) {
            currentHeaders = cols.map(c => cleanString(c));
            currentHeaders[0] = 'Turma';
            continue;
        }
        
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

const dataOthers = parseJsonlInput('scratch/step4.json');
console.log('Parsed dataOthers length:', dataOthers.length);
if (dataOthers.length > 0) {
    console.log('First:', dataOthers[0]);
}
