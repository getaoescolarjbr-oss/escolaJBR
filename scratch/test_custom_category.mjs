import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  console.log('Testing inserting a custom category string...');
  const { error } = await supabase.from('calendario_eventos').insert({
    data: '2026-12-31',
    categoria: 'letivo:#ff0000',
    abreviacao: 'TEST',
    descricao: 'Testing custom color inside category',
    criado_por: 'Test'
  });

  if (error) {
    console.error('Insert failed:', error.message);
  } else {
    console.log('Insert succeeded! The category column accepts custom strings.');
    console.log('Cleaning up...');
    await supabase.from('calendario_eventos').delete().eq('data', '2026-12-31');
  }
}

run().catch(console.error);
