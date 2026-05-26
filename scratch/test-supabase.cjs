const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testando conexão Supabase...');
  const { data, error } = await supabase.from('calendario_eventos').select('*');
  if (error) {
    console.error('Erro retornado pela consulta:', error);
  } else {
    console.log('Consulta concluída com sucesso! Total de registros retornados:', data.length);
    console.log('Registros:', data);
  }
}

test();
