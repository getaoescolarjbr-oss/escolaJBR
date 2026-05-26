import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function tryInsert(table, fields) {
  const { error } = await supabase.from(table).insert(fields).select();
  return error?.message || 'OK';
}

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  const FAKE_UUID = 'fa7b2888-c15d-4e12-ad76-d1c85e92462d'; // aluno real

  // --- Descobrir colunas de NOTAS ---
  console.log('=== NOTAS ===');
  // Tenta campos comuns
  const notasFields = [
    { aluno_id: FAKE_UUID, valor: 7.0 },
    { aluno_id: FAKE_UUID, nota: 7.0 },
    { aluno_id: FAKE_UUID, avaliacao_id: FAKE_UUID, valor: 7.0 },
    { aluno_id: FAKE_UUID, avaliacao_id: FAKE_UUID },
  ];
  for (const f of notasFields) {
    const msg = await tryInsert('notas', f);
    console.log(JSON.stringify(Object.keys(f)), '->', msg.substring(0, 100));
  }

  // --- Descobrir colunas de AVALIACOES ---
  console.log('\n=== AVALIACOES ===');
  const avFields = [
    { turma_id: FAKE_UUID, disciplina_id: FAKE_UUID, nome: 'Teste', valor_maximo: 10 },
    { turma_id: FAKE_UUID, disciplina_id: FAKE_UUID, nome: 'Teste', valor_maximo: 10, bimestre: 1 },
    { turma_id: FAKE_UUID, disciplina_id: FAKE_UUID, nome: 'Teste', valor_maximo: 10, bimestre_numero: 1 },
    { turma_id: FAKE_UUID, disciplina_id: FAKE_UUID, nome: 'Teste', valor_maximo: 10, tipo: 'prova' },
  ];
  for (const f of avFields) {
    const msg = await tryInsert('avaliacoes', f);
    console.log(JSON.stringify(Object.keys(f)), '->', msg.substring(0, 120));
  }

  // --- Descobrir colunas de CHAMADAS ---
  console.log('\n=== CHAMADAS ===');
  const chamFields = [
    { aluno_id: FAKE_UUID, presenca: false, data_aula: '2026-03-01' },
    { aluno_id: FAKE_UUID, presenca: false, data_aula: '2026-03-01', disciplina_id: FAKE_UUID },
    { aluno_id: FAKE_UUID, presenca: false, data_aula: '2026-03-01', disciplina_id: FAKE_UUID, turma_id: FAKE_UUID },
    { aluno_id: FAKE_UUID, presenca: false, data_aula: '2026-03-01', disciplina_id: FAKE_UUID, turma_id: FAKE_UUID, id_do_professor: FAKE_UUID },
  ];
  for (const f of chamFields) {
    const msg = await tryInsert('chamadas', f);
    console.log(JSON.stringify(Object.keys(f)), '->', msg.substring(0, 120));
  }

  // --- Turmas completas ---
  console.log('\n=== TODAS AS TURMAS ===');
  const { data: turmas } = await supabase.from('turmas').select('id, nome').order('nome');
  console.log(JSON.stringify(turmas, null, 2));
}

run().catch(console.error);
