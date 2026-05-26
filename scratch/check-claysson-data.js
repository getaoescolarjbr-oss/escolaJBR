import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('=== DADOS ESPECÍFICOS DO CLAYSSON XAVIER DA SILVA ===');
  
  // Login como coordenador para ter visão total
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  if (loginError) {
    console.error('Erro de login:', loginError.message);
    return;
  }

  const clayssonProfId = 'bac1e182-e553-46ee-88ad-e8fdae347021';

  // 1. Buscar alocações do Claysson
  const { data: allocs } = await supabase
    .from('alocacoes_v2')
    .select('id, turma_id, turmas(nome), disciplina_id, disciplinas(nome)')
    .eq('professor_id', clayssonProfId);
  
  console.log('Alocações do Claysson em alocacoes_v2:');
  if (allocs) {
    allocs.forEach(a => {
      console.log(`- Alocação ID ${a.id}: Turma = ${a.turmas?.nome} (${a.turma_id}), Disciplina = ${a.disciplinas?.nome} (${a.disciplina_id})`);
    });
  } else {
    console.log('Nenhuma alocação encontrada.');
  }

  // 2. Buscar avaliações do Claysson
  const { data: avals } = await supabase
    .from('avaliacoes')
    .select('id, nome, valor_maximo, turma_id, disciplina_id, bimestre_id')
    .eq('professor_id', clayssonProfId);

  console.log('\nAvaliações do Claysson em avaliacoes:');
  if (avals && avals.length > 0) {
    for (const a of avals) {
      const { data: countData } = await supabase
        .from('notas_avaliacoes')
        .select('id', { count: 'exact' })
        .eq('avaliacao_id', a.id);
      
      const { data: t } = await supabase.from('turmas').select('nome').eq('id', a.turma_id).single();
      const { data: d } = await supabase.from('disciplinas').select('nome').eq('id', a.disciplina_id).single();

      console.log(`- Avaliação ID ${a.id}: '${a.nome}' (${a.valor_maximo} pts), Bimestre = ${a.bimestre_id}, Turma = ${t?.nome} (${a.turma_id}), Disciplina = ${d?.nome} (${a.disciplina_id}) -> ${countData?.length || 0} notas associadas.`);
    }
  } else {
    console.log('Nenhuma avaliação encontrada.');
  }
}

run().catch(console.error);
