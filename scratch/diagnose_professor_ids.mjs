import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });
  console.log('✅ Authenticated\n');

  // Let's get some teachers from professores table
  const { data: profs } = await supabase.from('professores').select('id, nome, email');
  console.log(`=== PROFESSORES IN DB (${profs?.length || 0}) ===`);
  profs?.forEach(p => {
    console.log(`  - ID: ${p.id} | Name: ${p.nome} | Email: ${p.email}`);
  });

  // Let's get evaluations that were created for "Nota 1º Bimestre"
  const { data: avals } = await supabase
    .from('avaliacoes')
    .select('id, nome, turma_id, disciplina_id, professor_id')
    .eq('nome', 'Nota 1º Bimestre')
    .eq('bimestre_id', 1)
    .limit(10);
  
  console.log('\n=== SAMPLE EVALUATIONS CREATED ===');
  avals?.forEach(a => {
    console.log(`  - ID: ${a.id} | Name: ${a.nome} | Turma: ${a.turma_id} | Disciplina: ${a.disciplina_id} | Professor ID: ${a.professor_id}`);
  });

  // Let's check allocations for one of the turmas, e.g. 2º Ano B
  const { data: allocs } = await supabase
    .from('alocacoes_v2')
    .select('id, professor_id, turma_id, disciplina_id')
    .eq('turma_id', 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae')
    .limit(10);

  console.log('\n=== SAMPLE ALLOCATIONS FOR 2º ANO B ===');
  allocs?.forEach(al => {
    console.log(`  - ID: ${al.id} | Professor ID: ${al.professor_id} | Turma: ${al.turma_id} | Disciplina: ${al.disciplina_id}`);
  });
}

main().catch(console.error);
