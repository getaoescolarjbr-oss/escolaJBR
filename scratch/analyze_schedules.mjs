import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  console.log('Fetching first 20 schedules...');
  const { data: horarios } = await supabase.from('horarios').select('*').limit(20);
  console.log('Schedules sample:');
  console.dir(horarios, { depth: null });

  console.log('Fetching all disciplines...');
  const { data: disciplinas } = await supabase.from('disciplinas').select('*').order('nome');
  console.log('Disciplines list:');
  console.dir(disciplinas, { depth: null });
}

run().catch(console.error);
