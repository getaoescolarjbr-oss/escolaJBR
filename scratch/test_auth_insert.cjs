const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  if (authError) {
    console.error('Login error:', authError);
    return;
  }

  console.log('Login successful! Email:', authData.user.email);
  
  // Try inserting a student
  const testStudent = {
    nome: 'TESTE ALUNO ANTIGRAVITY',
    turma_id: 'bd1df917-640f-431e-81eb-4d8e88bdc6f5', // 6º Ano A
    aluno_numero: 99,
    status: 'Ativo'
  };

  console.log('Trying to insert student...');
  const { data, error } = await supabase.from('alunos').insert(testStudent).select();
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success! Student:', data);
    // Delete the test student immediately to leave the DB clean
    const { error: delError } = await supabase.from('alunos').delete().eq('id', data[0].id);
    if (delError) console.error('Error deleting test student:', delError);
    else console.log('Deleted test student successfully.');
  }
}

test();
