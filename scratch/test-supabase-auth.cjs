const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Fazendo login...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  if (authError) {
    console.error('Erro de login:', authError);
    return;
  }

  console.log('Login efetuado! Usuário:', authData.user.email);
  
  console.log('Buscando dados da tabela calendario_eventos...');
  const { data, error } = await supabase.from('calendario_eventos').select('*');
  if (error) {
    console.error('Erro na consulta:', error);
  } else {
    console.log('Sucesso! Total de registros retornados:', data.length);
    console.log('Registros:', data);
  }
}

test();
