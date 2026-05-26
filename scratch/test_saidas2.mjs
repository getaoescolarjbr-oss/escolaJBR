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

  console.log('\n--- Teste Saídas de Sala ---');
  const res = await supabase.from('saidas_sala').insert({
      aluno_id: alunoId,
      id_do_professor: prof.id,
      destino: 'Banheiro',
      hora_saida: new Date().toISOString(),
      status: 'Fora'
  }).select('id');
  console.log('Insert apenas com destino/status:', res.error ? res.error.message : 'OK: ' + res.data[0].id);

  console.log('\n--- Teste Vistos V2 ---');
  const resVisto = await supabase.from('vistos_v2').insert({
      atividade_id: '0c3dcac5-59e2-47c0-99ee-cc69f8cbcb39', // Id valido do teste anterior
      aluno_id: alunoId,
      valor: '.'
  }).select('id');
  console.log('Insert Vistos_v2:', resVisto.error ? resVisto.error.message : 'OK: ' + resVisto.data[0].id);

}

run().catch(console.error);
