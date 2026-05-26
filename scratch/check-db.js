import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('=== TESTE DE CONEXÃO E DIAGNÓSTICO DO BANCO ===');
  
  // 1. Verificar Professores
  const { data: profs, error: errProfs } = await supabase
    .from('professores')
    .select('id, nome, email, bimestre_atual')
    .limit(5);
  
  if (errProfs) {
    console.error('Erro ao buscar professores:', errProfs);
  } else {
    console.log(`Professores no banco (total: ${profs?.length || 0} listados):`);
    console.log(profs);
  }

  // 2. Verificar Avaliações
  const { data: avals, error: errAvals } = await supabase
    .from('avaliacoes')
    .select('*')
    .limit(5);

  if (errAvals) {
    console.error('Erro ao buscar avaliacoes:', errAvals);
  } else {
    console.log(`Avaliacoes no banco (total listados: ${avals?.length || 0}):`);
    console.log(avals);
  }

  // Contagem total de avaliações
  const { count: totalAvals, error: errCountAvals } = await supabase
    .from('avaliacoes')
    .select('*', { count: 'exact', head: true });
  console.log(`Total geral de avaliações no banco:`, errCountAvals ? errCountAvals.message : totalAvals);

  // 3. Verificar Notas de Avaliações
  const { data: notas, error: errNotas } = await supabase
    .from('notas_avaliacoes')
    .select('*')
    .limit(5);

  if (errNotas) {
    console.error('Erro ao buscar notas_avaliacoes:', errNotas);
  } else {
    console.log(`Notas de avaliações no banco (total listados: ${notas?.length || 0}):`);
    console.log(notas);
  }

  const { count: totalNotas, error: errCountNotas } = await supabase
    .from('notas_avaliacoes')
    .select('*', { count: 'exact', head: true });
  console.log(`Total geral de notas no banco:`, errCountNotas ? errCountNotas.message : totalNotas);

  // 4. Verificar se há alunos
  const { count: totalAlunos, error: errCountAlunos } = await supabase
    .from('alunos')
    .select('*', { count: 'exact', head: true });
  console.log(`Total geral de alunos no banco:`, errCountAlunos ? errCountAlunos.message : totalAlunos);
}

check();
