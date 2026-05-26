import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Logging in as gestaoescolarjbr@gmail.com...');
  await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  const { data: ativs, error: ativError } = await supabase.from('atividades_diárias').select('*').limit(1);
  if (ativError) console.error('Atividades Error:', ativError.message);
  else console.log('Atividades Diárias schema:', ativs[0] ? Object.keys(ativs[0]) : 'No records');

  const { data: vistos, error: vistosError } = await supabase.from('vistos_v2').select('*').limit(1);
  if (vistosError) console.error('Vistos Error:', vistosError.message);
  else console.log('Vistos V2 schema:', vistos[0] ? Object.keys(vistos[0]) : 'No records');

  // Let's also check if there are actual activities and vistos in the database
  const { count: totalAtivs } = await supabase.from('atividades_diárias').select('*', { count: 'exact', head: true });
  console.log('Total activities in db:', totalAtivs);

  const { count: totalVistos } = await supabase.from('vistos_v2').select('*', { count: 'exact', head: true });
  console.log('Total vistos in db:', totalVistos);
}

run().catch(console.error);
