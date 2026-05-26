import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // 1) Find the students shown in the screenshot
  const studentNames = [
    'ANA CLARA PAIVA VAZ',
    'ANA LUIZA DOS SANTOS BRUM',
    'BEATRIZ MALTA DE ALMEIDA FERNANDES VIANA',
    'DANIELLA DE ALMEIDA RODRIGUES',
    'DAVI ALEXANDRE XAVIER DINIZ'
  ];

  const { data: dbStudents } = await supabase
    .from('alunos')
    .select('id, nome, turma_id, aluno_numero, status')
    .in('nome', studentNames);
  
  console.log('Students found:');
  console.log(dbStudents);

  if (dbStudents && dbStudents.length > 0) {
    const turmaId = dbStudents[0].turma_id;
    console.log(`\nTurma ID for these students: ${turmaId}`);

    // Get Turma name
    const { data: dbTurma } = await supabase
      .from('turmas')
      .select('*')
      .eq('id', turmaId)
      .maybeSingle();
    console.log('Turma details:', dbTurma);

    // 2) Find all allocations for this Turma
    const { data: allocs } = await supabase
      .from('alocacoes_v2')
      .select('*, professores(nome, email), disciplinas(nome)')
      .eq('turma_id', turmaId);
    console.log('\nAllocations for this Turma:');
    console.log(allocs?.map(a => ({
      professor_nome: a.professores?.nome,
      professor_email: a.professores?.email,
      disciplina_nome: a.disciplinas?.nome,
      professor_id: a.professor_id,
      disciplina_id: a.disciplina_id
    })));

    // 3) Find all B1 evaluations for this Turma
    const { data: avals } = await supabase
      .from('avaliacoes')
      .select('*')
      .eq('turma_id', turmaId)
      .eq('bimestre_id', 1);
    console.log(`\nB1 evaluations in 'avaliacoes' for this Turma: ${avals?.length || 0}`);
    console.log(avals?.map(a => ({
      id: a.id,
      nome: a.nome,
      professor_id: a.professor_id,
      disciplina_id: a.disciplina_id
    })));

    // 4) Check notes in 'notas_avaliacoes' for these students
    const studentIds = dbStudents.map(s => s.id);
    const { data: notas } = await supabase
      .from('notas_avaliacoes')
      .select('*, avaliacoes(nome, professor_id, disciplina_id, bimestre_id)')
      .in('aluno_id', studentIds);
    console.log(`\nGrades for these students in the database: ${notas?.length || 0}`);
    console.log(notas?.slice(0, 10).map(n => ({
      aluno_id: n.aluno_id,
      nota: n.nota,
      avaliacao_nome: n.avaliacoes?.nome,
      bimestre: n.avaliacoes?.bimestre_id,
      professor_id: n.avaliacoes?.professor_id,
      disciplina_id: n.avaliacoes?.disciplina_id
    })));
  }
}

run().catch(console.error);
