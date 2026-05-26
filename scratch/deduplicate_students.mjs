import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });
  console.log('✅ Authenticated to deduplicate students\n');

  // Duplicates to delete:
  const duplicates = [
    '80faca2b-cada-4d1a-a1ec-a58c8e66a803', // LUCAS JEFERSON FLORENCIO COSTA duplicate (Num 35)
    'e3f2946f-8708-40d0-844d-5a55abed224d', // PEDRO HENRIQUE SANTOS PEREIRA duplicate (Num 30)
    '5e837fe4-b4cb-4161-8add-871b978bfd2b'  // VINICIUS FRÔES DA SILVA duplicate (Num 31)
  ];

  console.log('Deleting duplicate student records...');
  const { data, error } = await supabase
    .from('alunos')
    .delete()
    .in('id', duplicates)
    .select();

  if (error) {
    console.error('❌ Delete error:', error.message);
  } else {
    console.log('✅ Successfully deleted duplicates:', data);
  }
}

run().catch(console.error);
