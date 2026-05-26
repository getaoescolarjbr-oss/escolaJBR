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

  const tryField = async (fieldName) => {
    const res = await supabase.from('saidas_sala').insert({
        aluno_id: alunoId,
        disciplina_id: 'cdbd47ad-a44c-4d71-9478-4588c9cfd318',
        turma_id: '40240976-446c-43a0-89ee-41ee204125ea',
        destino: 'Banheiro',
        hora_saida: new Date().toISOString(),
        status: 'Fora',
        [fieldName]: prof.id
    }).select('id');
    console.log(`Testando ${fieldName}:`, res.error ? res.error.message : 'OK: ' + res.data[0].id);
  }

  console.log('\n--- Teste Colunas de Professor em Saídas de Sala ---');
  await tryField('id_do_professor');
  await tryField('professor_id');
  await tryField('id_professor');
}

run().catch(console.error);
