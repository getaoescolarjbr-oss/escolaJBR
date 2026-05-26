import fs from 'fs';

// This script extracts tab-separated grade data from multiple source files
// and consolidates into a clean parsed_grades.json

function parseTabData(text, defaultHeaders = null) {
    const lines = text.split(/\r?\n/);
    const records = [];
    let headers = defaultHeaders ? [...defaultHeaders] : null;
    
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        
        const cols = line.split('\t');
        if (cols.length < 3) continue;
        
        // Check if this is a header row
        const firstCol = cols[0].trim();
        if (firstCol === 'Turma' || firstCol === 'Série/ Turma' || firstCol === 'Série/Turma') {
            headers = cols.map(c => {
                const h = c.trim();
                // Normalize header names
                if (h === 'Série/ Turma' || h === 'Série/Turma') return 'Turma';
                return h;
            });
            continue;
        }
        
        // Skip lines that look like "continue" or non-data
        if (cols.length < 4) continue;
        
        // Check if first col looks like a class name (contains "Ano" or "º")
        if (!firstCol.match(/\d.*Ano|º/) && !firstCol.match(/^[67829]º/)) continue;
        
        if (headers && cols.length >= 4) {
            const row = {};
            for (let i = 0; i < headers.length; i++) {
                row[headers[i]] = (cols[i] || '').trim();
            }
            records.push(row);
        }
    }
    return records;
}

// === SOURCE 1: 6º Ano A (from extracted_user_request.txt) ===
const src1 = fs.readFileSync('scratch/extracted_user_request.txt', 'utf8');
const data6A = parseTabData(src1);
console.log(`6º Ano A records: ${data6A.length}`);

// === SOURCE 2: From full_msg_step87.txt (7º Ano A + partial data before truncation) ===
const src2 = fs.readFileSync('scratch/full_msg_step87.txt', 'utf8');
const data87Start = parseTabData(src2);
console.log(`Step87 start records: ${data87Start.length}`);

// === SOURCE 3: From full_msg_step158.txt (2º Ano B continuation + 2º Ano C + 3º Ano B) ===
const src3 = fs.readFileSync('scratch/full_msg_step158.txt', 'utf8');

// This file starts without a header row for 2º Ano B, then has a header for 2º Ano C
// The 2º Ano B header was in the previous (truncated) message
// Headers for 2º Ano B (from step87):
const headers2AnoB = [
    'Turma', 'Nome do Estudante', 'Arte', 'Biologia', 'Educação Física', 'Estudo Orientado',
    'Filosofia', 'Física', 'Geografia', 'História', 'Laboratório de Linguas',
    'Língua Espanhola', 'Língua Inglesa', 'Língua Portuguesa - RA',
    'Língua Portuguesa - Literatura e Produção Textual', 'Matemática', 'Matemática - RA',
    'Matemática - Geometria', 'Prática de Escrita e Estilo', 'Língua Portuguesa',
    'Química', 'Sociologia', 'Unidade Curricular I', 'Unidade Curricular II',
    'Unidade Curricular III', 'Unidade Curricular IV', 'Faltas', 'Situação'
];

// Parse step158 - first section is 2º Ano B (without header), then 2º Ano C (with header), then 3º Ano B
const lines158 = src3.split(/\r?\n/);
const records158_2B = [];
const rest158 = [];
let inUserRequest = false;
let foundNewHeader = false;

for (const rawLine of lines158) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.includes('<USER_REQUEST>')) { inUserRequest = true; continue; }
    if (line.includes('</USER_REQUEST>')) break;
    if (!inUserRequest) continue;
    if (line.startsWith('Vou enviar')) continue;
    
    const cols = line.split('\t');
    if (cols.length < 3) continue;
    
    const firstCol = cols[0].trim();
    
    // Check if this is a new header row
    if (firstCol === 'Turma' || firstCol === 'Série/ Turma') {
        foundNewHeader = true;
        rest158.push(line);
        continue;
    }
    
    if (foundNewHeader) {
        rest158.push(line);
        continue;
    }
    
    // Before new header, these are 2º Ano B rows
    if (firstCol.includes('2º Ano B') || firstCol.includes('2Âº Ano B')) {
        if (cols.length >= 4) {
            const row = {};
            for (let i = 0; i < headers2AnoB.length; i++) {
                row[headers2AnoB[i]] = (cols[i] || '').trim();
            }
            records158_2B.push(row);
        }
    }
}

console.log(`2º Ano B records from step158: ${records158_2B.length}`);

// Parse the remaining section (2º Ano C + 3º Ano B)
const data158Rest = parseTabData(rest158.join('\n'));
console.log(`Step158 rest records (2C + 3B): ${data158Rest.length}`);

// === MERGE DATA ===
// From step87: we have 7º Ano A (11 students before truncation) + end of 2º Ano B
// The end of step87 shows 2º Ano B end records, which overlap with start of step158
// We need to deduplicate

// Get 7º Ano A records from step87
const data7A = data87Start.filter(r => r['Turma'] && r['Turma'].includes('7'));
console.log(`7º Ano A records: ${data7A.length}`);

// Get end of 2º Ano B from step87 (the truncated end section)
const data87End2B = data87Start.filter(r => r['Turma'] && r['Turma'].includes('2'));
console.log(`2º Ano B records from step87 end: ${data87End2B.length}`);

// Merge 2º Ano B: step87 end + step158 (step158 takes precedence as it's the resent data)
// Deduplicate by student name
const map2B = new Map();
for (const r of data87End2B) {
    map2B.set(r['Nome do Estudante'], r);
}
for (const r of records158_2B) {
    map2B.set(r['Nome do Estudante'], r);
}
const allData2B = [...map2B.values()];
console.log(`2º Ano B total unique records: ${allData2B.length}`);

// Get 2º Ano C and 3º Ano B from step158
const data2C = data158Rest.filter(r => r['Turma'] && r['Turma'].includes('2') && r['Turma'].includes('C'));
const data3B = data158Rest.filter(r => r['Turma'] && r['Turma'].includes('3'));
console.log(`2º Ano C records: ${data2C.length}`);
console.log(`3º Ano B records: ${data3B.length}`);

// ALL DATA
const allData = [...data6A, ...data7A, ...allData2B, ...data2C, ...data3B];

// Group by Turma for summary
const byTurma = {};
for (const r of allData) {
    const t = r['Turma'] || 'Unknown';
    byTurma[t] = (byTurma[t] || 0) + 1;
}
console.log('\n=== SUMMARY BY TURMA ===');
for (const [t, count] of Object.entries(byTurma)) {
    console.log(`  ${t}: ${count} records`);
}
console.log(`\nTotal records: ${allData.length}`);

// Write the consolidated data
fs.writeFileSync('scratch/parsed_grades_v2.json', JSON.stringify(allData, null, 2), 'utf8');
console.log('\nWrote scratch/parsed_grades_v2.json');
