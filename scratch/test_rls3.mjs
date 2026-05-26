import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  const turmaId = '40240976-446c-43a0-89ee-41ee204125ea';
  const disciplinaId = 'cdbd47ad-a44c-4d71-9478-4588c9cfd318';
  const hoje = new Date().toISOString().split('T')[0];

  // Try insert with user_id = authData.user.id
  console.log('\n--- Testando insert atividades_diárias com user_id = user_id ---');
  let res = await supabase.from('atividades_di\u00e1rias').insert({
      id_do_professor: 'bac1e182-e553-46ee-88ad-e8fdae347021', // prof.id
      user_id: authData.user.id,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      bimestre_id: 2,
      data: hoje,
      descricao: 'Teste user_id'
  }).select('id');
  console.log(res.error ? res.error.message + ' (Code: ' + res.error.code + ')' : 'OK: ' + res.data[0].id);

}

run().catch(console.error);
