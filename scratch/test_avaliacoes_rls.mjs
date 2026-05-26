import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Logging in as gestaoescolarjbr@gmail.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }

  // Let's check if we can select from public.avaliacoes
  const { data: avals, error: selectError } = await supabase.from('avaliacoes').select('*').limit(1);
  if (selectError) {
    console.error('Select error:', selectError.message);
  } else {
    console.log('Select OK. Found:', avals.length);
    if (avals.length > 0) {
      // Let's try to update the first evaluation (adding a dummy update to see if it's allowed)
      const first = avals[0];
      const { data: updateData, error: updateError } = await supabase
        .from('avaliacoes')
        .update({ nome: first.nome })
        .eq('id', first.id)
        .select();
      
      if (updateError) {
        console.error('Update error:', updateError.message);
      } else {
        console.log('Update OK:', updateData);
      }
    }
  }
}

run().catch(console.error);
