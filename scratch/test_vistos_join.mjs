import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  const { data: ativs } = await supabase
      .from('atividades_diárias')
      .select('id')
      .eq('turma_id', '40240976-446c-43a0-89ee-41ee204125ea');

  const ativIds = ativs?.map(a => a.id) || [];
  console.log('Activity IDs:', ativIds);

  if (ativIds.length > 0) {
    const { data: vistos, error } = await supabase
        .from('vistos_v2')
        .select('aluno_id, valor, atividade_id!inner(disciplinas(nome))')
        .in('atividade_id', ativIds);

    if (error) {
      console.error('Vistos join error:', error.message);
    } else {
      console.log('Vistos join success:');
      console.dir(vistos, { depth: null });
    }
  } else {
    console.log('No activities found.');
  }
}

run().catch(console.error);
