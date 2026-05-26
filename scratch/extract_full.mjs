import fs from 'fs';

// Read the full transcript file
const transcriptPath = 'C:/Users/clays/.gemini/antigravity/brain/2f6649bb-d258-4295-bdb6-b21fcd230b03/.system_generated/logs/transcript.jsonl';
const rawContent = fs.readFileSync(transcriptPath, 'utf8');
const lines = rawContent.split('\n');

console.log('Total lines in transcript:', lines.length);

// Find all USER_INPUT lines
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('"type":"USER_INPUT"')) {
        try {
            const j = JSON.parse(line);
            const content = j.content;
            console.log(`\n=== Step ${j.step_index}, length: ${content.length} chars ===`);
            // Save full content without truncation
            fs.writeFileSync(`scratch/full_msg_step${j.step_index}.txt`, content, 'utf8');
            console.log(`Saved full content to scratch/full_msg_step${j.step_index}.txt`);
        } catch(e) {
            console.log(`Error parsing line ${i}:`, e.message.substring(0, 100));
        }
    }
}
