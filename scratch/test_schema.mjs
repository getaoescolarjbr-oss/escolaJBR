import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  const { data: saidas, error: saidasErr } = await supabase.from('saidas_sala').select('*').limit(1);
  if (saidasErr) console.error('Erro:', saidasErr.message);
  else if (saidas?.length > 0) {
    console.log('Colunas de saidas_sala:', Object.keys(saidas[0]));
  } else {
    console.log('Tabela vazia, tentando insert falho...');
    const { error } = await supabase.from('saidas_sala').insert({ x: 1 });
    console.log(error?.message);
  }

  const { data: chamadas, error: chErr } = await supabase.from('chamadas').select('*').limit(1);
  if (chErr) console.error('Erro chamadas:', chErr.message);
  else if (chamadas?.length > 0) {
    console.log('Colunas de chamadas:', Object.keys(chamadas[0]));
  }

}

run().catch(console.error);
