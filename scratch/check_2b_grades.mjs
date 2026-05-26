import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  const clayssonId = 'bac1e182-e553-46ee-88ad-e8fdae347021';
  const turmaId = 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae'; // 2º Ano B
  const disciplinaId = 'cdbd47ad-a44c-4d71-9478-4588c9cfd318'; // Química

  // Fetch B1 evaluations
  const { data: avals } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('professor_id', clayssonId)
    .eq('turma_id', turmaId)
    .eq('disciplina_id', disciplinaId)
    .eq('bimestre_id', 1);

  console.log(`Evaluations for 2º Ano B - Chemistry:`, avals);

  if (avals && avals.length > 0) {
    const avalId = avals[0].id;
    // Fetch some grades
    const { data: grades } = await supabase
      .from('notas_avaliacoes')
      .select('*, alunos(nome)')
      .eq('avaliacao_id', avalId)
      .limit(10);
    console.log(`Sample B1 Chemistry grades for 2º Ano B:`, grades);
  }
}

run().catch(console.error);
