import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Logging in as gestaoescolarjbr@gmail.com...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  if (authErr) {
    console.error('Auth Error:', authErr.message);
    return;
  }
  console.log('Logged in! User ID:', authData.user.id);

  console.log('\n--- Querying Alunos ---');
  const { data: alunos, error: alunosErr } = await supabase.from('alunos').select('*').limit(3);
  console.log('Alunos Count:', alunos?.length, 'Error:', alunosErr?.message);

  console.log('\n--- Querying Ocorrências ---');
  const { data: ocorrencias, error: ocErr } = await supabase.from('ocorrências').select('*').limit(3);
  console.log('Ocorrências Count:', ocorrencias?.length, 'Error:', ocErr?.message);

  console.log('\n--- Querying Atividades Diárias ---');
  const { data: ativ, error: ativErr } = await supabase.from('atividades_diárias').select('*').limit(3);
  console.log('Atividades Diárias Count:', ativ?.length, 'Error:', ativErr?.message);

  console.log('\n--- Querying Vistos v2 ---');
  const { data: vistos, error: vistosErr } = await supabase.from('vistos_v2').select('*').limit(3);
  console.log('Vistos v2 Count:', vistos?.length, 'Error:', vistosErr?.message);

  console.log('\n--- Querying Saídas de Sala ---');
  const { data: saidas, error: saidasErr } = await supabase.from('saidas_sala').select('*').limit(3);
  console.log('Saídas de Sala Count:', saidas?.length, 'Error:', saidasErr?.message);
}

run().catch(console.error);
