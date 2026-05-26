import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // 1. Turmas - sem serie
  const { data: turmas } = await supabase.from('turmas').select('*').limit(3);
  if (turmas?.length > 0) {
    console.log('TURMAS colunas:', Object.keys(turmas[0]));
    console.log('TURMAS sample:', JSON.stringify(turmas, null, 2));
  }

  // 2. Alunos - sem situacao
  const { data: alunos } = await supabase.from('alunos').select('*').limit(3);
  if (alunos?.length > 0) {
    console.log('\nALUNOS colunas:', Object.keys(alunos[0]));
    console.log('ALUNOS sample:', JSON.stringify(alunos[0], null, 2));
  }

  // 3. Notas - estrutura
  const { data: notas, error: notasErr } = await supabase.from('notas').select('*').limit(3);
  if (notasErr) console.log('\nNOTAS err:', notasErr.message);
  else {
    console.log('\nNOTAS colunas:', notas?.length > 0 ? Object.keys(notas[0]) : 'vazia - tentando insert de diagnose');
    // Tenta descobrir colunas por insert
    const { error: ni } = await supabase.from('notas').insert({ aluno_id: 'test', nota: 1 }).select();
    console.log('notas insert test:', ni?.message);
  }

  // 4. Avaliacoes - estrutura
  const { data: avals, error: avErr } = await supabase.from('avaliacoes').select('*').limit(3);
  if (avErr) console.log('\nAVALIACOES err:', avErr.message);
  else {
    console.log('\nAVALIACOES colunas:', avals?.length > 0 ? Object.keys(avals[0]) : 'vazia');
    const { error: ai } = await supabase.from('avaliacoes').insert({ turma_id: 'test', nome: 'x' }).select();
    console.log('avaliacoes insert test:', ai?.message);
  }

  // 5. Chamadas - descobrir colunas
  const { data: cham } = await supabase.from('chamadas').select('*').limit(3);
  if (cham?.length > 0) {
    console.log('\nCHAMADAS colunas:', Object.keys(cham[0]));
    console.log('Sample:', JSON.stringify(cham[0], null, 2));
  } else {
    const { error: ci } = await supabase.from('chamadas').insert({ aluno_id: 'test', presenca: false }).select();
    console.log('\nCHAMADAS insert test:', ci?.message);
  }

  // 6. Bimestres
  const { data: bim } = await supabase.from('bimestres').select('*').limit(10);
  console.log('\nBIMESTRES:', JSON.stringify(bim, null, 2));
}

run().catch(console.error);
