const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:\\Users\\clays\\.gemini\\antigravity\\brain\\4e394d9f-29ed-48ed-91a2-d1c298e1869a\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 219) {
      console.log('--- FOUND STEP 219 ---');
      console.log(obj.content);
      fs.writeFileSync('scratch/extracted_user_request.txt', obj.content, 'utf8');
      console.log('Wrote to scratch/extracted_user_request.txt');
      break;
    }
  } catch (e) {
    // ignore parse error
  }
}
