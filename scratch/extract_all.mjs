import fs from 'fs';

const logPath = "C:\\Users\\clays\\.gemini\\antigravity\\brain\\2f6649bb-d258-4295-bdb6-b21fcd230b03\\.system_generated\\logs\\transcript.jsonl";
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

const payloads = [];

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const json = JSON.parse(line);
        if (json.type === 'USER_INPUT' && json.content) {
            const text = json.content;
            const startIdx = text.indexOf('<USER_REQUEST>');
            const endIdx = text.indexOf('</USER_REQUEST>');
            if (startIdx !== -1 && endIdx !== -1) {
                const payload = text.slice(startIdx + '<USER_REQUEST>'.length, endIdx);
                payloads.push(payload);
            }
        }
    } catch (e) {
        // ignore
    }
}

fs.writeFileSync('scratch/all_raw_data.txt', payloads.join('\n'));
console.log(`Extracted ${payloads.length} payloads with tables.`);
