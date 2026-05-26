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

  // Try the OpenAPI endpoint with correct headers
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    }
  });
  const text = await resp.text();
  const schema = JSON.parse(text);
  
  console.log('Schema keys:', Object.keys(schema).join(', '));
  
  // Find the paths or definitions
  const paths = schema?.paths || {};
  const notasPaths = Object.keys(paths).filter(p => p.includes('notas'));
  console.log('notas paths:', notasPaths);
  
  if (notasPaths.length > 0) {
    const notasSchema = paths[notasPaths[0]];
    console.log('notas path detail:', JSON.stringify(notasSchema?.get?.parameters?.slice(0,20), null, 2));
  }
  
  // Check definitions
  const defs = schema?.definitions || {};
  console.log('Definition keys:', Object.keys(defs).slice(0,20).join(', '));
  
  // Print notas specifically
  if (defs.notas) {
    console.log('NOTAS DEFINITION:', JSON.stringify(defs.notas, null, 2));
  }
}

run().catch(console.error);
