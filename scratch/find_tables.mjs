import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  
  // Try to query some non-standard tables that might hold faltas
  const queries = ['faltas', 'faltas_bimestre', 'boletins', 'notas_bimestre'];
  for (const table of queries) {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
          console.log(`Table ${table} error: ${error.message}`);
      } else {
          console.log(`Table ${table} EXISTS! Data:`, data);
      }
  }
}
run();
