import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // Query information_schema to get column definitions for notas table
  const { data, error } = await supabase.rpc('get_notas_columns').select();
  console.log('RPC result:', data, error?.message);

  // Try information_schema via a raw approach
  // PostgREST allows querying information_schema via /rest/v1/
  // Let's try via a select on information_schema.columns
  const { data: cols, error: colsErr } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'notas');
  console.log('\nnotas columns from information_schema:', JSON.stringify(cols, null, 2));
  if (colsErr) console.log('err:', colsErr.message);
}

run().catch(console.error);
