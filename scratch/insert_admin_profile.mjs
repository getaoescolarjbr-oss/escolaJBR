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
  const userId = authData.user.id;
  console.log('Logged in! User ID:', userId);

  // Try to insert a professor record
  const { data, error } = await supabase
    .from('professores')
    .insert({
      id: 'd7192977-80cc-4df9-9235-08623d093db2', // use the user_id as the profile id too, or a new UUID
      user_id: userId,
      nome: 'Administrador JBR',
      email: 'gestaoescolarjbr@gmail.com',
      cargo: 'Coordenador',
      config_visto_metodo: 'gradual',
      config_visto_valor_total: 10,
      bimestre_atual: 1
    })
    .select();

  if (error) {
    console.error('Insert error:', error.message, error);
  } else {
    console.log('Insert success!', data);
  }
}

run().catch(console.error);
