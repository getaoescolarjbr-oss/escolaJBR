import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Testando a consulta em atas_alunos...');
  
  // Vamos autenticar primeiro se houver alguma RLS ativa que exija login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  if (authError) {
    console.error('Erro de autenticação:', authError.message);
  } else {
    console.log('Autenticado com sucesso para o teste!');
  }

  const { data, error } = await supabase
    .from('atas_alunos')
    .select(`
      *,
      alunos!aluno_id(
        id,
        nome,
        turmas!turma_id(nome)
      )
    `)
    .order('numero_sequencial', { ascending: false })
    .limit(5);

  if (error) {
    console.error('ERRO NA CONSULTA:', error);
  } else {
    console.log('SUCESSO! Dados retornados:', data);
    if (data && data.length > 0) {
      console.log('Primeiro registro retornado:', JSON.stringify(data[0], null, 2));
    }
  }
}

run().catch(console.error);
