import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('--- Logging in as Admin ---');
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  const clayssonId = 'bac1e182-e553-46ee-88ad-e8fdae347021';

  // Check how many evaluations exist in total for Bimestre 1
  const { data: allB1Avals, error: b1Err } = await supabase
    .from('avaliacoes')
    .select('id, professor_id, turma_id, disciplina_id, nome')
    .eq('bimestre_id', 1);
  console.log(`Total B1 avaliacoes: ${allB1Avals?.length || 0}`);
  if (allB1Avals) {
    const profs = Array.from(new Set(allB1Avals.map(a => a.professor_id)));
    console.log('Professors in allB1Avals:', profs);
  }

  // Check how many evaluations in avaliacoes_bimestrais
  const { data: allB1AvalsBim, error: b1BimErr } = await supabase
    .from('avaliacoes_bimestrais')
    .select('id, professor_id, turma_id, disciplina_id, nome')
    .eq('bimestre_id', 1);
  console.log(`Total B1 avaliacoes_bimestrais: ${allB1AvalsBim?.length || 0}`);
  if (allB1AvalsBim) {
    const profsBim = Array.from(new Set(allB1AvalsBim.map(a => a.professor_id)));
    console.log('Professors in allB1AvalsBim:', profsBim);
  }

  // Let's query Claysson's specific allocations
  const { data: clAllocs } = await supabase
    .from('alocacoes_v2')
    .select('*, turmas(nome), disciplinas(nome)')
    .eq('professor_id', clayssonId);
  console.log('Claysson allocations:');
  console.log(clAllocs?.map(a => ({
    turma: a.turmas?.nome,
    disciplina: a.disciplinas?.nome,
    turma_id: a.turma_id,
    disciplina_id: a.disciplina_id
  })));

  // Let's check if there are any evaluations/grades for Claysson's turma/disciplina
  if (clAllocs && clAllocs.length > 0) {
    for (const alloc of clAllocs) {
      const { data: av } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('turma_id', alloc.turma_id)
        .eq('disciplina_id', alloc.disciplina_id)
        .eq('bimestre_id', 1);
      console.log(`Turma: ${alloc.turmas?.nome}, Disciplina: ${alloc.disciplinas?.nome}`);
      console.log(`- avaliacoes count: ${av?.length || 0}`);
      
      const { data: avBim } = await supabase
        .from('avaliacoes_bimestrais')
        .select('*')
        .eq('turma_id', alloc.turma_id)
        .eq('disciplina_id', alloc.disciplina_id)
        .eq('bimestre_id', 1);
      console.log(`- avaliacoes_bimestrais count: ${avBim?.length || 0}`);
    }
  }
}

run().catch(console.error);
