const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testando query original...');
  const { data: d1, error: e1 } = await supabase
    .from('ocorrências')
    .select('*')
    .limit(1);
  console.log('Original data count:', d1 ? d1.length : 0, 'Error:', e1);

  console.log('\nTestando query com join professores...');
  const { data: d2, error: e2 } = await supabase
    .from('ocorrências')
    .select('*, professores!id_do_professor(nome, cargo)')
    .limit(1);
  console.log('Join data count:', d2 ? d2.length : 0, 'Error:', e2);

  console.log('\nTestando query com join alternativo 1 (apenas professores)...');
  const { data: d3, error: e3 } = await supabase
    .from('ocorrências')
    .select('*, professores(nome, cargo)')
    .limit(1);
  console.log('Join alt 1 data count:', d3 ? d3.length : 0, 'Error:', e3);
}

test();
