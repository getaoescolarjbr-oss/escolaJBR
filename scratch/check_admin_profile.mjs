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

  const { data: prof, error: profErr } = await supabase
    .from('professores')
    .select('*')
    .eq('email', 'gestaoescolarjbr@gmail.com');

  console.log('Profile by email:', prof, 'Error:', profErr?.message);

  const { data: profByUid, error: profByUidErr } = await supabase
    .from('professores')
    .select('*')
    .eq('user_id', userId);

  console.log('Profile by user_id:', profByUid, 'Error:', profByUidErr?.message);
}

run().catch(console.error);
