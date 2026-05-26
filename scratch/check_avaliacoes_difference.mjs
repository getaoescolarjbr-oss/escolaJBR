import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // Let's see if we have 'avaliacoes_bimestrais' table
  const { data: colsAv, error: errAv } = await supabase.from('avaliacoes').select('*').limit(1);
  const { data: colsAvBim, error: errAvBim } = await supabase.from('avaliacoes_bimestrais').select('*').limit(1);
  
  console.log('avaliacoes schema / first row:', colsAv);
  console.log('avaliacoes error:', errAv?.message);
  console.log('avaliacoes_bimestrais schema / first row:', colsAvBim);
  console.log('avaliacoes_bimestrais error:', errAvBim?.message);

  // Let's query one of Claysson's assessments in 'avaliacoes'
  const clayssonId = 'bac1e182-e553-46ee-88ad-e8fdae347021';
  const { data: clAvals } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('professor_id', clayssonId);
  console.log('Claysson B1 assessments in avaliacoes:', clAvals);
}

run().catch(console.error);
