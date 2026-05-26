const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('=== LOGANDO COMO PROFESSOR PARA VISIBILIDADE DE ALOCAÇÕES ===');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  if (authError) {
    console.error('Erro de login:', authError);
    return;
  }
  console.log('Login efetuado com sucesso!');

  // 1. Buscar todas as alocações do banco
  console.log('Buscando alocações...');
  const { data: allocs, error: allocError } = await supabase
    .from('alocacoes_v2')
    .select('professor_id, turma_id, disciplina_id');

  if (allocError) {
    console.error('Erro ao buscar alocações:', allocError);
    return;
  }
  console.log(`Total de alocações encontradas: ${allocs.length}`);

  // Mapear "turma_id|disciplina_id" -> professor_id
  const allocMap = {};
  allocs.forEach(a => {
    allocMap[`${a.turma_id}|${a.disciplina_id}`] = a.professor_id;
  });

  // 2. Buscar todas as avaliações que estão sem professor_id
  console.log('Buscando avaliações pendentes de professor...');
  const { data: avals, error: avalError } = await supabase
    .from('avaliacoes')
    .select('id, turma_id, disciplina_id, nome')
    .is('professor_id', null);

  if (avalError) {
    console.error('Erro ao buscar avaliações:', avalError);
    return;
  }
  console.log(`Total de avaliações sem professor: ${avals.length}`);

  let updatedCount = 0;
  let notFoundCount = 0;

  // 3. Atualizar cada avaliação com o professor_id correto
  for (const av of avals) {
    const key = `${av.turma_id}|${av.disciplina_id}`;
    const profId = allocMap[key];

    if (profId) {
      const { error: updateError } = await supabase
        .from('avaliacoes')
        .update({ professor_id: profId })
        .eq('id', av.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar avaliação ${av.id} (${av.nome}): ${updateError.message}`);
      } else {
        console.log(`✅ Avaliação atualizada: ${av.nome} (Turma: ${av.turma_id}, Disciplina: ${av.disciplina_id}) → Professor: ${profId}`);
        updatedCount++;
      }
    } else {
      console.log(`⚠️ Alocação não encontrada para a chave: ${key} (${av.nome})`);
      notFoundCount++;
    }
  }

  console.log('\n=== CONCLUSÃO ===');
  console.log(`Total de avaliações atualizadas com professor_id: ${updatedCount}`);
  console.log(`Total de avaliações sem correspondência de alocação: ${notFoundCount}`);
}

main().catch(console.error);
