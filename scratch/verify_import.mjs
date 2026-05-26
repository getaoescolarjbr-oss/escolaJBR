/**
 * verify_import.mjs
 * 
 * Verifies the import results:
 * 1. Checks avaliacoes and notas_avaliacoes counts (as admin)
 * 2. Logs in as a TEACHER to verify chamadas are visible/readable
 * 3. Shows a sample of what teachers will see
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

// Target turmas for this import
const TARGET_TURMAS = {
  '6º Ano A': 'bd1df917-640f-431e-81eb-4d8e88bdc6f5',
  '7º Ano A': '72fdf92e-4b47-4d97-8e02-c2e89548c80e',
  '2º Ano B': 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae',
  '2º Ano C': '689045b6-42fb-4b34-9dec-7f4bd2cd6d13',
  '3º Ano B': 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a',
};

async function verifyAsAdmin() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });
  console.log('=== ADMIN VIEW ===\n');

  // Count avaliacoes per turma
  for (const [turmaName, turmaId] of Object.entries(TARGET_TURMAS)) {
    const { count: aval } = await supabase
      .from('avaliacoes').select('*', { count: 'exact', head: true })
      .eq('turma_id', turmaId).eq('bimestre_id', 1).eq('nome', 'Nota 1º Bimestre');
    const { count: notas } = await supabase
      .from('notas_avaliacoes')
      .select('*, avaliacoes!inner(turma_id, bimestre_id)', { count: 'exact', head: true })
      .eq('avaliacoes.turma_id', turmaId).eq('avaliacoes.bimestre_id', 1);

    console.log(`${turmaName}: ${aval} avaliacoes | ${notas ?? '?'} notas`);
  }

  // Check alunos status diversity
  const { data: statusData } = await supabase
    .from('alunos')
    .select('status, turma_id')
    .in('turma_id', Object.values(TARGET_TURMAS));

  const statusCounts = {};
  for (const row of (statusData || [])) {
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
  }
  console.log('\nAluno status distribution (target turmas):', statusCounts);
}

async function verifyAsTeacher(email, password, label) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`\n⚠️ Could not login as ${label}: ${error.message}`);
    return;
  }
  console.log(`\n=== TEACHER VIEW: ${label} ===\n`);

  // Get professor record
  const { data: prof } = await supabase.from('professores').select('id, nome').single();
  if (!prof) { console.log('No professor record found'); return; }
  console.log(`Professor: ${prof.nome} (id: ${prof.id})`);

  // Avaliacoes visible to this teacher
  const { data: avals, count: avalCount } = await supabase
    .from('avaliacoes')
    .select('id, nome, turma_id, disciplina_id, bimestre_id', { count: 'exact' })
    .eq('professor_id', prof.id)
    .eq('bimestre_id', 1);
  console.log(`Avaliacoes visible (bimestre 1): ${avalCount}`);

  // Chamadas visible to this teacher
  const { count: chamadasCount } = await supabase
    .from('chamadas')
    .select('*', { count: 'exact', head: true })
    .eq('professor_id', prof.id);
  console.log(`Chamadas visible: ${chamadasCount}`);

  // Sample of notas
  if (avals && avals.length > 0) {
    const { data: notas, count: notasCount } = await supabase
      .from('notas_avaliacoes')
      .select('nota, avaliacao_id', { count: 'exact' })
      .in('avaliacao_id', avals.slice(0, 10).map(a => a.id));
    console.log(`Notas for first 10 avaliacoes: ${notasCount}`);
    if (notas && notas.length > 0) {
      console.log('  Sample grades:', notas.slice(0, 5).map(n => n.nota));
    }
  }
}

async function main() {
  await verifyAsAdmin();

  // Try Claysson (chemistry teacher, has classes in 2B, 2C, 3B)
  // His email was seen in test_columns.mjs: claysson.127082@edutec.sed.ms.gov.br
  await verifyAsTeacher(
    'claysson.127082@edutec.sed.ms.gov.br',
    'Goodm@n1',
    'Claysson (Química)'
  );

  // Print SQL to manually insert the 3 missing students
  console.log('\n=== SQL TO INSERT 3 MISSING STUDENTS ===');
  console.log('Run this in the Supabase SQL Editor:\n');
  console.log(`
-- Get next aluno_numero for 2º Ano B  
WITH max_2b AS (SELECT COALESCE(MAX(aluno_numero), 0) + 1 AS next_num FROM alunos WHERE turma_id = 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae'),
-- Get next aluno_numero for 3º Ano B
max_3b AS (SELECT COALESCE(MAX(aluno_numero), 0) AS max_num FROM alunos WHERE turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a')
INSERT INTO alunos (nome, turma_id, aluno_numero, status) VALUES
  ('LUCAS JEFERSON FLORENCIO COSTA', 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae', (SELECT next_num FROM max_2b), 'Ativo'),
  ('PEDRO HENRIQUE SANTOS PEREIRA', 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a', (SELECT max_num + 1 FROM max_3b), 'Ativo'),
  ('VINICIUS FRÔES DA SILVA', 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a', (SELECT max_num + 2 FROM max_3b), 'Ativo')
RETURNING id, nome, turma_id, aluno_numero;
  `);
}

main().catch(console.error);
