import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // Get all professors
  const { data: profs } = await supabase.from('professores').select('id, nome, cargo, area_conhecimento').order('nome');
  console.log('PROFESSORES:', JSON.stringify(profs, null, 2));

  // Get all turmas
  const { data: turmas } = await supabase.from('turmas').select('id, nome, nivel').order('nome');
  console.log('\nTURMAS:', JSON.stringify(turmas, null, 2));

  // Get all disciplinas
  const { data: discs } = await supabase.from('disciplinas').select('id, nome').order('nome');
  console.log('\nDISCIPLINAS:', JSON.stringify(discs, null, 2));

  // Check existing avaliacoes
  const { data: avs } = await supabase.from('avaliacoes').select('*').limit(10);
  console.log('\nEXISTING AVALIACOES (first 10):', JSON.stringify(avs, null, 2));
  
  // Check existing notas_avaliacoes
  const { data: notas } = await supabase.from('notas_avaliacoes').select('*').limit(5);
  console.log('\nEXISTING NOTAS_AVALIACOES (first 5):', JSON.stringify(notas, null, 2));
}

run().catch(console.error);
