import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkStudent(nome) {
  const { data: students } = await supabase
    .from('alunos')
    .select('id, nome, turma_id, status, aluno_numero')
    .ilike('nome', `%${nome}%`);

  console.log(`\n=== Student: ${nome} ===`);
  for (const s of (students || [])) {
    const { count: grades } = await supabase
      .from('notas_avaliacoes')
      .select('*', { count: 'exact', head: true })
      .eq('aluno_id', s.id);

    const { count: chamadas } = await supabase
      .from('chamadas')
      .select('*', { count: 'exact', head: true })
      .eq('aluno_id', s.id);

    console.log(`ID: ${s.id} | Class: ${s.turma_id} | Num: ${s.aluno_numero} | Status: ${s.status} | Grades: ${grades} | Chamadas: ${chamadas}`);
  }
}

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });
  await checkStudent('LUCAS JEFERSON FLORENCIO COSTA');
  await checkStudent('PEDRO HENRIQUE SANTOS PEREIRA');
  await checkStudent('VINICIUS FRÔES DA SILVA');
}

run().catch(console.error);
