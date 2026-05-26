import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  const { data: prof } = await supabase
    .from('professores').select('id').eq('user_id', authData.user.id).single();

  const turmaId = '40240976-446c-43a0-89ee-41ee204125ea';
  const disciplinaId = 'cdbd47ad-a44c-4d71-9478-4588c9cfd318';
  const hoje = new Date().toISOString().split('T')[0];

  console.log('\n--- Teste 1: id_do_professor = prof.id, professor_id = prof.id ---');
  let res = await supabase.from('atividades_di\u00e1rias').insert({
      id_do_professor: prof.id,
      professor_id: prof.id,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      bimestre_id: 2,
      data: hoje,
      descricao: 'Teste 1'
  }).select('id');
  console.log(res.error ? res.error.message : 'OK: ' + res.data[0].id);

  console.log('\n--- Teste 2: id_do_professor = prof.id, professor_id = user.id ---');
  res = await supabase.from('atividades_di\u00e1rias').insert({
      id_do_professor: prof.id,
      professor_id: authData.user.id,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      bimestre_id: 2,
      data: hoje,
      descricao: 'Teste 2'
  }).select('id');
  console.log(res.error ? res.error.message : 'OK: ' + res.data[0].id);
  
  console.log('\n--- Teste 3: professor_id = user.id (sem id_do_professor) ---');
  res = await supabase.from('atividades_di\u00e1rias').insert({
      professor_id: authData.user.id,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      bimestre_id: 2,
      data: hoje,
      descricao: 'Teste 3'
  }).select('id');
  console.log(res.error ? res.error.message : 'OK: ' + res.data[0].id);
}

run().catch(console.error);
