import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  const turmaId = 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae'; // 2º Ano B

  const { data: avals, error } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('turma_id', turmaId)
    .eq('bimestre_id', 1);

  if (error) {
    console.error('Error fetching avaliacoes:', error);
    return;
  }

  console.log(`All evaluations for 2º Ano B (B1):`, avals?.length);
  console.log(avals?.map(a => ({
    id: a.id,
    nome: a.nome,
    professor_id: a.professor_id,
    disciplina_id: a.disciplina_id
  })));

  if (avals) {
    for (const a of avals) {
      const { count, error: countErr } = await supabase
        .from('notas_avaliacoes')
        .select('*', { count: 'exact', head: true })
        .eq('avaliacao_id', a.id);
      console.log(`Evaluation ${a.id} (${a.nome}) has ${count} grades. Error: ${countErr?.message}`);
    }
  }
}

run().catch(console.error);
