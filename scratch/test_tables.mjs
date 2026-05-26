import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  const { data: ativ2, error: e1 } = await supabase.from('atividades_v2').select('*').limit(1);
  console.log('atividades_v2:', e1 ? e1.message : 'EXISTE');

  const { data: ativ3, error: e2 } = await supabase.from('atividades_diarias').select('*').limit(1);
  console.log('atividades_diarias:', e2 ? e2.message : 'EXISTE');

  const { data: ch2, error: e3 } = await supabase.from('chamadas_v2').select('*').limit(1);
  console.log('chamadas_v2:', e3 ? e3.message : 'EXISTE');
}

run().catch(console.error);
