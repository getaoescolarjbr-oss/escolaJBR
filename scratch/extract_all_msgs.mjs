import fs from 'fs';

const transcriptPath = 'C:/Users/clays/.gemini/antigravity/brain/2f6649bb-d258-4295-bdb6-b21fcd230b03/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

const userInputs = lines.filter(l => l.includes('"type":"USER_INPUT"'));
console.log('Total user inputs:', userInputs.length);

let allGradeData = '';
let headers6A = '';
let headers7A = '';
let headers2C = '';

for (let i = 0; i < userInputs.length; i++) {
    try {
        const j = JSON.parse(userInputs[i]);
        const content = j.content;
        
        // Check if content has grade table data (tab-separated with turma names)
        if (content.includes('\t') && (content.includes('Ano A') || content.includes('Ano B') || content.includes('Ano C'))) {
            console.log(`\n=== USER MSG ${i} (step ${j.step_index}) ===`);
            console.log(content.substring(0, 300));
            console.log('...[total length:', content.length, ']');
            
            // Save full content  
            fs.writeFileSync(`scratch/msg_${i}_step${j.step_index}.txt`, content, 'utf8');
            console.log(`Saved to scratch/msg_${i}_step${j.step_index}.txt`);
        }
    } catch(e) {
        // skip
    }
}
