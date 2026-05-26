import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

let supabaseUrl = '';
let supabaseAnonKey = '';

if (fs.existsSync(envPath)) {
  const fileContent = fs.readFileSync(envPath, 'utf8');
  const lines = fileContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = trimmed.substring('VITE_SUPABASE_URL='.length).trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = trimmed.substring('VITE_SUPABASE_ANON_KEY='.length).trim();
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const turmaId = 'bd1df917-640f-431e-81eb-4d8e88bdc6f5'; // 6º Ano A
  console.log("Fetching allocations for 6º Ano A...");

  const { data: allocations, error: errAlloc } = await supabase
    .from('alocacoes_v2')
    .select('*, professores(nome), disciplinas(nome)')
    .eq('turma_id', turmaId);

  if (errAlloc) {
    console.error("Error fetching allocations:", errAlloc);
  } else {
    console.log(`Allocations found: ${allocations?.length || 0}`);
    allocations?.forEach(a => {
      console.log(`- Subject: ${a.disciplinas?.nome} (${a.disciplina_id}) -> Teacher: ${a.professores?.nome} (${a.professor_id})`);
    });
  }

  console.log("\nFetching all teachers...");
  const { data: teachers, error: errTeachers } = await supabase
    .from('professores')
    .select('id, nome, cargo');
  if (errTeachers) {
    console.error("Error fetching teachers:", errTeachers);
  } else {
    console.log(`Teachers found: ${teachers?.length || 0}`);
    teachers?.forEach(t => {
      console.log(`- ${t.nome} (ID: ${t.id}, Cargo: ${t.cargo})`);
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
