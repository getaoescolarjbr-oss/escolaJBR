// Script de diagnóstico para verificar tabela landing_avisos e RLS
// Execute com: node scratch/diagnose_rav.mjs

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

async function query(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...opts.headers
    },
    ...opts
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, statusText: res.statusText, data: json };
}

async function main() {
  console.log('=== DIAGNÓSTICO TABELA landing_avisos ===\n');

  // 1. SELECT - Verificar dados existentes
  console.log('1. Testando SELECT...');
  const sel = await query('landing_avisos?select=id,titulo,mensagem,cor_alerta&limit=5');
  console.log(`   Status: ${sel.status} ${sel.statusText}`);
  console.log(`   Dados:`, JSON.stringify(sel.data, null, 2));

  // 2. SELECT específico RAV_CONFIG
  console.log('\n2. Verificando se RAV_CONFIG já existe...');
  const ravSel = await query('landing_avisos?titulo=eq.RAV_CONFIG&cor_alerta=eq.config&select=id,titulo,mensagem');
  console.log(`   Status: ${ravSel.status}`);
  console.log(`   Dados:`, JSON.stringify(ravSel.data, null, 2));

  // 3. INSERT teste
  console.log('\n3. Testando INSERT (criar RAV_CONFIG)...');
  const ins = await query('landing_avisos', {
    method: 'POST',
    body: JSON.stringify({ titulo: 'RAV_CONFIG', mensagem: 'bimestral', cor_alerta: 'config' })
  });
  console.log(`   Status: ${ins.status} ${ins.statusText}`);
  console.log(`   Resposta:`, JSON.stringify(ins.data, null, 2));

  if (ins.status === 201) {
    // 4. Se inseriu, testa UPDATE e depois limpa
    const newId = Array.isArray(ins.data) && ins.data[0]?.id;
    if (newId) {
      console.log(`\n4. Testando UPDATE no id=${newId}...`);
      const upd = await query(`landing_avisos?id=eq.${newId}`, {
        method: 'PATCH',
        body: JSON.stringify({ mensagem: 'semestral' })
      });
      console.log(`   Status: ${upd.status} ${upd.statusText}`);

      console.log('\n5. Limpando registro de teste...');
      const del = await query(`landing_avisos?id=eq.${newId}`, { method: 'DELETE' });
      console.log(`   Status: ${del.status}`);
    }
  } else if (ins.status === 201 || ins.status === 409) {
    console.log('   Registro já existe ou foi criado.');
  }

  console.log('\n=== FIM DO DIAGNÓSTICO ===');
  console.log('\nSe o INSERT retornou 403, existe uma política RLS que bloqueia INSERT anônimo.');
  console.log('Solução: Adicionar policy no Supabase: INSERT para role authenticated.');
}

main().catch(console.error);
