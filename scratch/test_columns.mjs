// Script de diagnóstico — descobre o nome real das colunas de 'chamadas'
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });

  // Tenta SELECT em chamadas para ver quais colunas existem
  console.log('\n=== COLUNAS DA TABELA chamadas ===');
  const { data: chamadas, error: chamErr } = await supabase
    .from('chamadas').select('*').limit(1);
  if (chamErr) console.error('Erro:', chamErr.message);
  else {
    if (chamadas?.length > 0) {
      console.log('Colunas encontradas:', Object.keys(chamadas[0]));
      console.log('Exemplo de linha:', chamadas[0]);
    } else {
      console.log('Tabela vazia - tentando insert mínimo para ver erro de coluna...');
      // Tenta insert com campos possíveis
      const { error: e1 } = await supabase.from('chamadas').insert({ professor_id: 'test' }).select();
      console.log('professor_id:', e1?.message);
      const { error: e2 } = await supabase.from('chamadas').insert({ id_professor: 'test' }).select();
      console.log('id_professor:', e2?.message);
      const { error: e3 } = await supabase.from('chamadas').insert({ id_do_professor: 'test' }).select();
      console.log('id_do_professor:', e3?.message);
    }
  }

  // Verifica colunas de atividades_diárias também
  console.log('\n=== COLUNAS DE atividades_diárias ===');
  const { data: ativ, error: ativErr } = await supabase
    .from('atividades_di\u00e1rias').select('*').limit(1);
  if (ativErr) console.error('Erro SELECT:', ativErr.message);
  else {
    if (ativ?.length > 0) {
      console.log('Colunas:', Object.keys(ativ[0]));
      console.log('Exemplo:', ativ[0]);
    } else {
      console.log('Tabela atividades_diárias vazia (ou bloqueada por RLS no SELECT também)');
    }
  }

  // Tenta descobrir nome do campo professor em atividades_diárias
  console.log('\n=== TESTE campos de atividades_diárias ===');
  const campos = ['professor_id', 'id_do_professor', 'id_professor'];
  for (const campo of campos) {
    const obj = { [campo]: 'test' };
    const { error } = await supabase.from('atividades_di\u00e1rias').insert(obj).select();
    if (error?.code === 'PGRST204') {
      console.log(`${campo}: NÃO EXISTE`);
    } else {
      // Qualquer outro erro (RLS, tipo, etc.) significa que a coluna EXISTE
      console.log(`${campo}: EXISTE (erro: ${error?.code} - ${error?.message?.substring(0, 60)})`);
    }
  }
}

run().catch(console.error);
