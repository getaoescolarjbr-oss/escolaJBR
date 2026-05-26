import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  const { data, error } = await supabase.from('calendario_eventos').select('*').limit(1);
  if (error) {
    console.error('Error fetching event:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns of calendario_eventos:', Object.keys(data[0]));
    console.log('Sample data:', data[0]);
  } else {
    console.log('calendario_eventos has 0 records. Let\'s try to insert/simulate a row:');
    const { error: insError } = await supabase.from('calendario_eventos').insert({
      data: '2026-12-31',
      categoria: 'normal',
      abreviacao: 'TEST',
      descricao: 'Testing',
      criado_por: 'Test'
    });
    if (insError) {
      console.log('Insert test error:', insError.message);
    } else {
      console.log('Insert succeeded! Cleaning up...');
      await supabase.from('calendario_eventos').delete().eq('data', '2026-12-31');
    }
  }
}

run().catch(console.error);
