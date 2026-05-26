import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // 1. Ver estrutura de turmas
  const { data: turmas, error: tErr } = await supabase.from('turmas').select('id, nome, serie').order('nome').limit(20);
  console.log('TURMAS:', JSON.stringify(turmas, null, 2));
  if (tErr) console.error('Turmas err:', tErr.message);

  // 2. Ver disciplinas
  const { data: discs, error: dErr } = await supabase.from('disciplinas').select('id, nome').order('nome').limit(30);
  console.log('\nDISCIPLINAS:', JSON.stringify(discs, null, 2));
  if (dErr) console.error('Disc err:', dErr.message);

  // 3. Ver estrutura de avaliacoes
  const { data: avals, error: aErr } = await supabase.from('avaliacoes').select('*').limit(3);
  if (aErr) console.error('Avals err:', aErr.message);
  else {
    if (avals?.length > 0) {
      console.log('\nAVALIACOES colunas:', Object.keys(avals[0]));
      console.log('Sample:', JSON.stringify(avals[0], null, 2));
    } else {
      console.log('\nAVALIACOES: vazia');
    }
  }

  // 4. Ver notas_alunos ou tabela similar
  const tables = ['notas_alunos', 'notas', 'resultados', 'lancamentos'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`\nTabela ${t} EXISTE. Colunas:`, data?.length > 0 ? Object.keys(data[0]) : 'vazia');
      if (data?.[0]) console.log('Sample:', JSON.stringify(data[0], null, 2));
    } else {
      console.log(`Tabela ${t}: ${error.message.substring(0, 60)}`);
    }
  }

  // 5. Ver alunos de uma turma
  const { data: alunos6A, error: alErr } = await supabase
    .from('alunos').select('id, nome, situacao').eq('turma_id', turmas?.[0]?.id).limit(5);
  if (alErr) console.error('Alunos err:', alErr.message);
  else console.log('\nALUNOS turma[0]:', JSON.stringify(alunos6A, null, 2));

  // 6. Ver chamadas estrutura
  const { data: cham, error: cErr } = await supabase.from('chamadas').select('*').limit(2);
  if (cErr) console.error('Chamadas err:', cErr.message);
  else {
    console.log('\nCHAMADAS colunas:', cham?.length > 0 ? Object.keys(cham[0]) : 'vazia');
    if (cham?.[0]) console.log('Sample:', JSON.stringify(cham[0], null, 2));
  }
}

run().catch(console.error);
