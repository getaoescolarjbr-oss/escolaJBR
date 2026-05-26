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

  const { data: avals, error: avalError } = await supabase.from('avaliacoes').select('*').limit(1);
  if (avalError) {
    console.error('Avaliacoes Error:', avalError.message);
  } else {
    console.log('Avaliacoes schema:', avals[0] ? Object.keys(avals[0]) : 'No records');
    if (avals[0]) console.log('Sample:', avals[0]);
  }
}

run().catch(console.error);
