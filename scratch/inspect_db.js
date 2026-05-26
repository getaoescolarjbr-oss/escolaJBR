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
  console.log("Listing tables from database via RPC/API...");
  const tables = [
    'chamadas', 'atividades_diárias', 'vistos_v2', 'saidas_sala', 
    'atrasos', 'saidas_antecipadas', 'ocorrências', 'matricula_info', 
    'alunos', 'turmas', 'disciplinas', 'avaliacoes', 'notas_avaliacoes',
    'professores', 'alocacoes_v2', 'horarios', 'atas_templates', 'atas_alunos',
    'landing_avisos', 'landing_noticias', 'landing_eventos', 'calendario_eventos', 'faltas'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table '${table}' status: Error/Not found (${error.message})`);
      } else {
        console.log(`Table '${table}' status: EXISTS, columns:`, Object.keys(data[0] || {}));
      }
    } catch (e) {
      console.log(`Table '${table}' error:`, e.message);
    }
  }
  
  console.log("Exiting inspect_db.js...");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
