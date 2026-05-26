import fs from 'fs';

const logPath = "C:\\Users\\clays\\.gemini\\antigravity\\brain\\2f6649bb-d258-4295-bdb6-b21fcd230b03\\.system_generated\\logs\\transcript.jsonl";
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

let lastUserInput = null;
for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const json = JSON.parse(line);
        if (json.type === 'USER_INPUT') {
            lastUserInput = json;
        }
    } catch (e) {
        // ignore
    }
}

if (lastUserInput) {
    fs.writeFileSync('scratch/step4.json', JSON.stringify(lastUserInput));
    console.log("Saved last user input successfully.");
} else {
    console.log("No USER_INPUT found.");
}
