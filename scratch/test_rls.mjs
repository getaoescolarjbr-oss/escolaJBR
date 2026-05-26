import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  console.log('Attempting anonymous insert...');
  const { error } = await supabase
    .from('landing_noticias')
    .insert([{
      titulo: 'Test Anonymous',
      conteudo: 'Test URL',
      categoria: 'INSTAGRAM',
      data_publicacao: new Date().toISOString()
    }]);

  if (error) {
    console.error('Anonymous insert failed:', error.message);
  } else {
    console.log('Anonymous insert succeeded!');
  }
}

testInsert().catch(console.error);
