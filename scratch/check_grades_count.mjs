import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  const avalId = '7cc0fbc9-e25e-4c45-89c6-7a094235aad1'; // 2º Ano B - Chemistry

  // Check how many grades in notas_avaliacoes for this avalId
  const { count, error } = await supabase
    .from('notas_avaliacoes')
    .select('*', { count: 'exact', head: true })
    .eq('avaliacao_id', avalId);
  
  console.log(`Count of grades in notas_avaliacoes for assessment ${avalId}: ${count}`);
  console.log(`Error:`, error?.message);

  // Let's query some rows directly without inner join
  const { data: rows } = await supabase
    .from('notas_avaliacoes')
    .select('*')
    .eq('avaliacao_id', avalId)
    .limit(10);
  console.log('Sample rows:', rows);
}

run().catch(console.error);
