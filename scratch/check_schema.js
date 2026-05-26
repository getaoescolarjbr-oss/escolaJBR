import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase.from('alunos').select('*').limit(1);
  if (error) {
    console.error('Error fetching student:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in "alunos":', Object.keys(data[0]));
    console.log('Sample data:', data[0]);
  } else {
    console.log('No data found in "alunos". Let us try to fetch table definition or describe it.');
  }
}

main();
