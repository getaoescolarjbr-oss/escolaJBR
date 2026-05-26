import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  console.log('--- Testando com professor_id ---');
  const { data: d1, error: e1 } = await supabase
    .from('vistos_v2')
    .select('*, atividade_id!inner(data, descricao, disciplinas(nome), professores!professor_id(nome))')
    .limit(1);

  if (e1) console.error('professor_id erro:', e1.message);
  else console.log('professor_id sucesso:', d1);

  console.log('--- Testando com id_do_professor ---');
  const { data: d2, error: e2 } = await supabase
    .from('vistos_v2')
    .select('*, atividade_id!inner(data, descricao, disciplinas(nome), professores!id_do_professor(nome))')
    .limit(1);

  if (e2) console.error('id_do_professor erro:', e2.message);
  else console.log('id_do_professor sucesso:', d2);
}

run().catch(console.error);
