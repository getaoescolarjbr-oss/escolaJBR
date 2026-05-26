
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

async function test() {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: d1, error: e1 } = await supabase.from('alunos').select('*').limit(1);
    console.log('alunos:', { data: d1, error: e1 });
    
    const { data: d2, error: e2 } = await supabase.from('turmas').select('*').limit(1);
    console.log('turmas:', { data: d2, error: e2 });

    const { data: d3, error: e3 } = await supabase.from('alocacoes_v2').select('*').limit(1);
    console.log('alocacoes_v2:', { data: d3, error: e3 });
}
test();
