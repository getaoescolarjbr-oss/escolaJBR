import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  console.log('--- Testando query corrigida ---');
  const { data, error } = await supabase
    .from('vistos_v2')
    .select('*, atividade_id!inner(data, descricao, disciplinas(nome), professores(nome))')
    .limit(3);

  if (error) {
    console.error('Erro na Query corrigida:', error.message);
  } else {
    console.log('Sucesso! Dados retornados:');
    console.dir(data, { depth: null });
  }
}

run().catch(console.error);
