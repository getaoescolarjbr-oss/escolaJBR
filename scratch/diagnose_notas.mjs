import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // 1) Read a row from notas to see all columns
  const { data: notasRow, error: notasErr } = await supabase.from('notas').select('*').limit(1);
  console.log('NOTAS row:', JSON.stringify(notasRow, null, 2));
  console.log('NOTAS err:', notasErr?.message);

  // 2) Read a row from avaliacoes to see all columns
  const { data: avRow, error: avErr } = await supabase.from('avaliacoes').select('*').limit(1);
  console.log('\nAVALIACOES row:', JSON.stringify(avRow, null, 2));
  console.log('AVALIACOES err:', avErr?.message);

  // 3) Read a row from chamadas
  const { data: chamRow, error: chamErr } = await supabase.from('chamadas').select('*').limit(1);
  console.log('\nCHAMADAS row:', JSON.stringify(chamRow, null, 2));
  console.log('CHAMADAS err:', chamErr?.message);

  // 4) Read a row from alunos
  const { data: alunosRow, error: alunosErr } = await supabase.from('alunos').select('*').limit(1);
  console.log('\nALUNOS row:', JSON.stringify(alunosRow, null, 2));
  console.log('ALUNOS err:', alunosErr?.message);

  // 5) Check turma_disciplinas or professor_turmas junction tables
  const tables = ['turma_disciplinas', 'professor_turmas', 'professor_disciplinas', 'turmas_disciplinas', 'professores'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(`\n${t.toUpperCase()} row:`, JSON.stringify(data, null, 2));
    if (error) console.log(`${t} err:`, error.message);
  }
}

run().catch(console.error);
