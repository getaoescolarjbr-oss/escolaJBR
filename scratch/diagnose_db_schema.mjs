import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // Get all table names in public schema using supabase RPC or by doing a query if we have RPCs.
  // Wait, we can query information_schema columns to inspect tables!
  const tables = ['alunos', 'chamadas', 'avaliacoes', 'notas_avaliacoes', 'alocacoes_v2', 'matricula_info', 'atividades_diárias', 'vistos_v2'];
  
  for (const table of tables) {
    const { data: cols, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', table);
      
    if (error) {
      console.log(`Error reading columns for ${table}:`, error.message);
    } else {
      console.log(`\n=== Table: ${table} ===`);
      cols.forEach(c => {
        console.log(`  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`);
      });
    }
  }
}

run().catch(console.error);
