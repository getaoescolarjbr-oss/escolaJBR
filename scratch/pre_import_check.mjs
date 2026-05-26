/**
 * pre_import_check.mjs
 * 
 * Checks the state of the DB before import:
 * 1. Cleans up broken/test avaliacoes
 * 2. Shows which (turma, disciplina) pairs have allocations for the 5 target classes
 * 3. Shows student count per target turma
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TARGET_TURMAS = {
  '6º Ano A': 'bd1df917-640f-431e-81eb-4d8e88bdc6f5',
  '7º Ano A': '72fdf92e-4b47-4d97-8e02-c2e89548c80e',
  '2º Ano B': 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae',
  '2º Ano C': '689045b6-42fb-4b34-9dec-7f4bd2cd6d13',
  '3º Ano B': 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a',
};

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });
  console.log('✅ Authenticated\n');

  // 1. Clean up broken test avaliacoes (with nome='Teste' or null turma_id/disc_id mismatch)
  const { error: cleanErr, count: cleanCount } = await supabase
    .from('avaliacoes')
    .delete()
    .or('nome.eq.Teste,bimestre_id.is.null');
  console.log(`🗑️ Cleaned ${cleanCount ?? 'unknown'} broken avaliacoes`);

  // 2. Students per target turma
  console.log('\n📋 Students per target turma:');
  for (const [turmaName, turmaId] of Object.entries(TARGET_TURMAS)) {
    const { count } = await supabase
      .from('alunos')
      .select('*', { count: 'exact', head: true })
      .eq('turma_id', turmaId);
    console.log(`  ${turmaName}: ${count} students`);
  }

  // 3. Allocations per target turma
  console.log('\n🔗 Allocations per target turma:');
  const { data: allocs } = await supabase
    .from('alocacoes_v2')
    .select('professor_id, turma_id, disciplina_id, professores(nome), disciplinas(nome)')
    .in('turma_id', Object.values(TARGET_TURMAS));
  
  const allocByTurma = {};
  for (const [turmaName, turmaId] of Object.entries(TARGET_TURMAS)) {
    allocByTurma[turmaId] = turmaName;
  }

  const grouped = {};
  for (const a of (allocs || [])) {
    const key = allocByTurma[a.turma_id] || a.turma_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      disciplina: a.disciplinas?.nome || a.disciplina_id,
      professor: a.professores?.nome || a.professor_id,
    });
  }

  for (const [turma, items] of Object.entries(grouped)) {
    console.log(`\n  ${turma} (${items.length} allocations):`);
    for (const item of items) {
      console.log(`    - ${item.disciplina} → ${item.professor}`);
    }
  }

  // 4. Existing "Nota 1º Bimestre" avaliacoes
  const { data: existingAvals, count: avalCount } = await supabase
    .from('avaliacoes')
    .select('id, nome, bimestre_id, turma_id', { count: 'exact' })
    .in('turma_id', Object.values(TARGET_TURMAS));
  console.log(`\n📝 Total existing avaliacoes for target turmas: ${avalCount}`);
}

run().catch(console.error);
