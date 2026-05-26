import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const loginRes = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  if (loginRes.error) {
    console.error('Login failed:', loginRes.error.message);
    return;
  }
  console.log('✅ Logged in successfully!');

  const tables = ['alunos', 'alocacoes_v2', 'avaliacoes', 'notas_avaliacoes', 'chamadas', 'professores', 'turmas', 'disciplinas'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table ${table}: Error fetching data - ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`✅ Table ${table}: Columns ->`, Object.keys(data[0]));
      console.log(`   Sample record:`, data[0]);
    } else {
      console.log(`⚠️ Table ${table}: Exists but is empty.`);
    }
  }

  // Check unique values of 'status' or 'situacao' in alunos
  const { data: statusCheck, error: statusErr } = await supabase.from('alunos').select('status').limit(100);
  if (statusErr) {
    const { data: situacaoCheck } = await supabase.from('alunos').select('situacao').limit(100);
    if (situacaoCheck) {
      const set = new Set(situacaoCheck.map(x => x.situacao));
      console.log('Unique situacao values in alunos:', Array.from(set));
    }
  } else {
    const set = new Set(statusCheck.map(x => x.status));
    console.log('Unique status values in alunos:', Array.from(set));
  }
}

run().catch(console.error);
