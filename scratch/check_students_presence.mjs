import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  if (authErr) {
    console.error('Login error:', authErr.message);
    return;
  }

  const { data: students, error: studentsErr } = await supabase
    .from('alunos')
    .select('id, nome, turma_id')
    .ilike('nome', '%LUCAS JEFERSON%');

  console.log('LUCAS JEFERSON presence:', students, studentsErr?.message);

  const { data: students2, error: students2Err } = await supabase
    .from('alunos')
    .select('id, nome, turma_id')
    .ilike('nome', '%PEDRO HENRIQUE SANTOS%');

  console.log('PEDRO HENRIQUE presence:', students2, students2Err?.message);

  const { data: students3, error: students3Err } = await supabase
    .from('alunos')
    .select('id, nome, turma_id')
    .ilike('nome', '%VINICIUS FR%');

  console.log('VINICIUS FRÔES presence:', students3, students3Err?.message);
}

run().catch(console.error);
