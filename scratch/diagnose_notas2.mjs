import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // We know avaliacoes has: id, professor_id, turma_id, disciplina_id, bimestre_id, nome, valor_maximo, created_at, data_avaliacao, publicada
  // avaliacoes test record ID: 1223ed4c-809e-4288-b078-7efb58878290
  const AVALIACAO_ID = '1223ed4c-809e-4288-b078-7efb58878290';
  const ALUNO_ID = 'fa7b2888-c15d-4e12-ad76-d1c85e92462d';

  // Try inserting into notas with likely column combinations
  const attempts = [
    { avaliacao_id: AVALIACAO_ID, aluno_id: ALUNO_ID, nota: 8.0 },
    { avaliacao_id: AVALIACAO_ID, aluno_id: ALUNO_ID, valor: 8.0 },
    { avaliacao_id: AVALIACAO_ID, aluno_id: ALUNO_ID, pontuacao: 8.0 },
    { avaliacao_id: AVALIACAO_ID, aluno_id: ALUNO_ID },
  ];

  for (const fields of attempts) {
    const { data, error } = await supabase.from('notas').insert(fields).select();
    const msg = error ? error.message : 'SUCCESS: ' + JSON.stringify(data);
    console.log(JSON.stringify(Object.keys(fields)), '->', msg.substring(0, 150));
  }

  // Also check bimestres table
  const { data: bim, error: bimErr } = await supabase.from('bimestres').select('*').limit(5);
  console.log('\nBIMESTRES:', JSON.stringify(bim, null, 2));
  if (bimErr) console.log('bimestres err:', bimErr.message);
}

run().catch(console.error);
