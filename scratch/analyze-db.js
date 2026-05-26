import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function analyze() {
  console.log('=== ANÁLISE DE INTEGRIDADE DAS NOTAS E AVALIAÇÕES ===');

  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  if (loginError) {
    console.error('Erro de login:', loginError.message);
    return;
  }
  console.log('Login efetuado com sucesso!');

  // 1. Carregar Alocações
  const { data: allocs, error: errAllocs } = await supabase
    .from('alocacoes_v2')
    .select('id, professor_id, turma_id, disciplina_id');

  if (errAllocs) {
    console.error('Erro de alocações:', errAllocs);
    return;
  }
  console.log(`Total de alocações (alocacoes_v2): ${allocs.length}`);

  // 2. Carregar Avaliações
  const { data: avals, error: errAvals } = await supabase
    .from('avaliacoes')
    .select('id, professor_id, turma_id, disciplina_id, bimestre_id, nome');

  if (errAvals) {
    console.error('Erro de avaliações:', errAvals);
    return;
  }
  console.log(`Total de avaliações (avaliacoes): ${avals.length}`);

  // 3. Verificar se as avaliações batem com as alocações em alocacoes_v2
  let incompatibilidades = 0;
  for (const aval of avals) {
    const matchingAlloc = allocs.find(a => 
      a.professor_id === aval.professor_id &&
      a.turma_id === aval.turma_id &&
      a.disciplina_id === aval.disciplina_id
    );
    if (!matchingAlloc) {
      incompatibilidades++;
      if (incompatibilidades <= 5) {
        console.warn(`[Incompatível] Avaliação ${aval.id} ('${aval.nome}'): professor ${aval.professor_id}, turma ${aval.turma_id}, disc ${aval.disciplina_id} não possui registro correspondente em alocacoes_v2.`);
      }
    }
  }
  console.log(`Avaliações incompatíveis com alocacoes_v2: ${incompatibilidades}`);

  // 4. Verificar se existem notas órfãs ou erradas
  const { data: notas, error: errNotas } = await supabase
    .from('notas_avaliacoes')
    .select('id, avaliacao_id, aluno_id, nota');

  if (errNotas) {
    console.error('Erro de notas:', errNotas);
    return;
  }
  console.log(`Total de notas (notas_avaliacoes): ${notas.length}`);

  // Buscar todos os alunos para verificar as turmas
  const { data: alunos, error: errAlunos } = await supabase
    .from('alunos')
    .select('id, nome, turma_id');
  
  if (errAlunos) {
    console.error('Erro de alunos:', errAlunos);
    return;
  }
  console.log(`Total de alunos: ${alunos.length}`);

  const alunosMap = new Map(alunos.map(a => [a.id, a]));
  const avalsMap = new Map(avals.map(a => [a.id, a]));

  let notasAlunosOrfaos = 0;
  let notasTurmaDiferente = 0;

  for (const nota of notas) {
    const aluno = alunosMap.get(nota.aluno_id);
    const aval = avalsMap.get(nota.avaliacao_id);

    if (!aluno) {
      notasAlunosOrfaos++;
    } else if (aval && aluno.turma_id !== aval.turma_id) {
      notasTurmaDiferente++;
      if (notasTurmaDiferente <= 5) {
        console.warn(`[Turma Diferente] Nota ${nota.id}: Aluno ${aluno.nome} (turma ${aluno.turma_id}) tem nota na avaliação ${aval.nome} (turma ${aval.turma_id})`);
      }
    }
  }

  console.log(`Notas de alunos inexistentes/órfãos: ${notasAlunosOrfaos}`);
  console.log(`Notas de alunos em turmas diferentes da avaliação: ${notasTurmaDiferente}`);

  // 5. Verificar se alguma avaliação tem notas associadas
  const avalsComNotas = new Set(notas.map(n => n.avaliacao_id));
  console.log(`Total de avaliações com pelo menos uma nota: ${avalsComNotas.size} de ${avals.length}`);
}

analyze();
