import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('=== VERIFICAÇÃO DE ALUNOS E NOTAS ===');
  
  // Login como coordenador
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  if (loginError) {
    console.error('Erro de login:', loginError.message);
    return;
  }

  // 1. Turma 2º Ano B
  const t2b = 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae';
  const { data: students2B } = await supabase.from('alunos').select('id, nome, aluno_numero').eq('turma_id', t2b).order('aluno_numero');
  console.log(`\nAlunos no 2º Ano B (Total: ${students2B?.length || 0}):`);
  students2B?.slice(0, 5).forEach(s => console.log(`  - #${s.aluno_numero}: ${s.nome} (${s.id})`));

  // 2. Notas para a avaliação 7cc0fbc9-e25e-4c45-89c6-7a094235aad1 (2º Ano B, Química)
  const { data: notas2B } = await supabase.from('notas_avaliacoes').select('aluno_id, nota').eq('avaliacao_id', '7cc0fbc9-e25e-4c45-89c6-7a094235aad1');
  console.log(`Notas cadastradas para a avaliação 7cc0fbc9-e25e-4c45-89c6-7a094235aad1 (Total: ${notas2B?.length || 0}):`);
  notas2B?.forEach(n => {
    const student = students2B?.find(s => s.id === n.aluno_id);
    console.log(`  - Aluno: ${student ? student.nome : 'Desconhecido'} (${n.aluno_id}) -> Nota: ${n.nota}`);
  });

  // 3. Buscar todas as notas de avaliações no 1º bimestre desta turma
  const { data: allAvals2B } = await supabase.from('avaliacoes').select('id, nome').eq('turma_id', t2b).eq('bimestre_id', 1);
  console.log(`\nAvaliações do 1º Bimestre no 2º Ano B:`);
  for (const av of allAvals2B || []) {
    const { data: notas } = await supabase.from('notas_avaliacoes').select('aluno_id, nota').eq('avaliacao_id', av.id);
    console.log(`  - Avaliação: ${av.nome} (${av.id}) -> ${notas?.length || 0} notas.`);
  }

}

run().catch(console.error);
