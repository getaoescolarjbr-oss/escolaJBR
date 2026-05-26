import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Use the REST API directly to hit PostgREST's introspection endpoint
async function run() {
  const { data: { session } } = await supabase.auth.signInWithPassword({ 
    email: 'gestaoescolarjbr@gmail.com', 
    password: 'Gest@ojbr' 
  });
  const token = session?.access_token || SUPABASE_ANON_KEY;

  // Use fetch to call PostgREST's schema endpoint
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/openapi+json'
    }
  });
  const schema = await resp.json();
  
  // Find notas table definition
  const notasDef = schema?.definitions?.notas || schema?.components?.schemas?.notas;
  console.log('notas definition:', JSON.stringify(notasDef, null, 2));

  // Also print all table names
  const defs = schema?.definitions || schema?.components?.schemas || {};
  console.log('\nAll tables:', Object.keys(defs).filter(k => !k.startsWith('_')).join(', '));
}

run().catch(console.error);
