import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: { session } } = await supabase.auth.signInWithPassword({ 
    email: 'gestaoescolarjbr@gmail.com', 
    password: 'Gest@ojbr' 
  });
  const token = session?.access_token || SUPABASE_ANON_KEY;

  // Try REST API endpoint with service role key (anon key may have RLS)
  // First, let's see what endpoint returns and log status
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    }
  });
  console.log('Status:', resp.status, resp.headers.get('content-type'));
  const text = await resp.text();
  console.log('Raw (first 500):', text.substring(0, 500));

  // Now brute-force: try inserting with all possible column name patterns for notas
  const ALUNO_ID = 'fa7b2888-c15d-4e12-ad76-d1c85e92462d';
  const singleField = ['nota', 'valor', 'pontuacao', 'grade', 'score', 'nota_valor', 'conceito'];

  for (const f of singleField) {
    const { error } = await supabase.from('notas').insert({ [f]: 5, aluno_id: ALUNO_ID }).select();
    const msg = error?.message || 'SUCCESS';
    if (!msg.includes("'aluno_id'")) {
      console.log(`aluno_id + ${f}:`, msg.substring(0, 100));
    } else if (!msg.includes("'aluno_id'")) {
      console.log(`aluno_id + ${f}:`, msg.substring(0, 100));
    }
  }
  
  // Try without aluno_id to find base columns
  for (const f of singleField) {
    const { error } = await supabase.from('notas').insert({ [f]: 5 }).select();
    const msg = error?.message || 'SUCCESS';
    console.log(`${f} only:`, msg.substring(0, 100));
  }
}

run().catch(console.error);
