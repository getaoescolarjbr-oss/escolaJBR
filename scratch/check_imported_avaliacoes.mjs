import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // Get Claysson's professor details
  const { data: claysson } = await supabase
    .from('professores')
    .select('id, nome, email')
    .ilike('nome', '%Claysson Xavier%')
    .single();

  console.log('Claysson Professor ID:', claysson.id);

  // Get Claysson's allocations in 2º Ano B
  const { data: allocs } = await supabase
    .from('alocacoes_v2')
    .select(`
      id,
      turma_id,
      disciplinas (id, nome)
    `)
    .eq('professor_id', claysson.id);

  console.log('Claysson allocations:', JSON.stringify(allocs, null, 2));

  // Get evaluations for 2º Ano B
  const { data: avals } = await supabase
    .from('avaliacoes')
    .select('id, nome, professor_id, disciplina_id, bimestre_id')
    .eq('turma_id', 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae')
    .eq('bimestre_id', 1);

  console.log('\nEvaluations in 2º Ano B (1st Bimester):');
  console.log(avals.map(a => `${a.nome} | ProfID: ${a.professor_id} | DiscID: ${a.disciplina_id}`));
}

run().catch(console.error);
