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

  const alunoId = 'da47b84a-43db-4fb5-aec0-5762fc677314';

  // Test 1: minimal - apenas aluno_id
  console.log('--- Teste saidas_sala apenas aluno_id ---');
  let res = await supabase.from('saidas_sala').insert({ aluno_id: alunoId }).select('*');
  console.log(res.error ? res.error.message : 'OK: ' + JSON.stringify(res.data[0]));

  // Test 2: with only columns added by user
  console.log('\n--- Teste com destino + hora_saida + status ---');
  res = await supabase.from('saidas_sala').insert({
    aluno_id: alunoId,
    destino: 'Banheiro',
    hora_saida: new Date().toISOString(),
    status: 'Fora'
  }).select('*');
  console.log(res.error ? res.error.message : 'OK: ' + JSON.stringify(res.data[0]));

  // Test 3: try chamadas with professor_id
  console.log('\n--- Teste chamadas com professor_id ---');
  res = await supabase.from('chamadas').insert({
    aluno_id: alunoId,
    professor_id: prof.id,
    disciplina_id: 'cdbd47ad-a44c-4d71-9478-4588c9cfd318',
    turma_id: '40240976-446c-43a0-89ee-41ee204125ea',
    presenca: true,
    data_aula: new Date().toISOString().split('T')[0]
  }).select('id');
  console.log(res.error ? res.error.message : 'OK: ' + res.data[0].id);
}

run().catch(console.error);
