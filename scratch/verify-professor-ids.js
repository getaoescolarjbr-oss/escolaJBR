import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('=== VERIFICAÇÃO DE ALINHAMENTO DE IDS DE PROFESSORES ===');
  
  // Login
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  if (loginError) {
    console.error('Erro de login:', loginError.message);
    return;
  }
  console.log('Login efetuado com sucesso (Coordenador)!');

  // 1. Carregar Professores do Banco
  const { data: professores, error: errProfs } = await supabase
    .from('professores')
    .select('id, nome, email, user_id');
  
  if (errProfs) {
    console.error('Erro ao buscar professores:', errProfs);
    return;
  }
  console.log(`Total de professores cadastrados: ${professores.length}`);
  
  // 2. Carregar Avaliações
  const { data: avals, error: errAvals } = await supabase
    .from('avaliacoes')
    .select('id, professor_id, nome, turma_id, disciplina_id');
  
  if (errAvals) {
    console.error('Erro ao buscar avaliações:', errAvals);
    return;
  }
  console.log(`Total de avaliações: ${avals.length}`);

  // Contagem de avaliações por professor
  const avalsPorProf = {};
  avals.forEach(a => {
    avalsPorProf[a.professor_id] = (avalsPorProf[a.professor_id] || 0) + 1;
  });

  console.log('\nAvaliações por professor_id no banco:');
  Object.entries(avalsPorProf).forEach(([profId, count]) => {
    const prof = professores.find(p => p.id === profId);
    console.log(`- Professor ID ${profId} (${prof ? prof.nome : 'NÃO ENCONTRADO EM PROFESSORES'}): ${count} avaliações`);
  });

  // 3. Verificar o user_id dos professores e comparar com o auth.users (se user_id está preenchido)
  console.log('\nProfessores com user_id preenchido (essencial para RLS e Login):');
  let comUserId = 0;
  professores.forEach(p => {
    if (p.user_id) {
      comUserId++;
      console.log(`- ${p.nome}: id = ${p.id}, user_id = ${p.user_id}, email = ${p.email}`);
    }
  });
  console.log(`Total de professores com user_id: ${comUserId} de ${professores.length}`);
}

run().catch(console.error);
