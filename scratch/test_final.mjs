import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TURMA_ID  = '40240976-446c-43a0-89ee-41ee204125ea';
const DISC_ID   = 'cdbd47ad-a44c-4d71-9478-4588c9cfd318';
const ALUNO_ID  = 'da47b84a-43db-4fb5-aec0-5762fc677314';
const BIMESTRE  = 2;
const HOJE      = new Date().toISOString().split('T')[0];

let passed = 0;
let failed = 0;
const ok  = (label)         => { console.log(`✅ ${label}`); passed++; };
const err = (label, msg)    => { console.log(`❌ ${label}: ${msg}`); failed++; };

async function run() {
  // LOGIN
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });
  if (authErr) { err('LOGIN', authErr.message); return; }
  ok('LOGIN');

  // PERFIL
  const { data: prof, error: profErr } = await supabase
    .from('professores').select('id').eq('user_id', authData.user.id).single();
  if (profErr || !prof) { err('PERFIL professor', profErr?.message); return; }
  ok('PERFIL professor');

  // 1. atividades_diárias — INSERT
  const { data: atDiv, error: atErr } = await supabase
    .from('atividades_di\u00e1rias')
    .insert({ id_do_professor: prof.id, turma_id: TURMA_ID, disciplina_id: DISC_ID, bimestre_id: BIMESTRE, data: HOJE, descricao: 'Diagnóstico Final' })
    .select('id').single();
  if (atErr) err('INSERT atividades_diárias', atErr.message);
  else ok('INSERT atividades_diárias');

  const atividadeId = atDiv?.id;

  // 2. vistos_v2 — INSERT
  if (atividadeId) {
    const { error: vistoErr } = await supabase
      .from('vistos_v2')
      .insert({ atividade_id: atividadeId, aluno_id: ALUNO_ID, valor: '.' });
    if (vistoErr) err('INSERT vistos_v2', vistoErr.message);
    else ok('INSERT vistos_v2');

    // 2b. verify SELECT
    const { data: checkV } = await supabase.from('vistos_v2').select('id').eq('atividade_id', atividadeId);
    if (checkV && checkV.length > 0) ok('SELECT vistos_v2 (dado persistido)');
    else err('SELECT vistos_v2 (dado persistido)', 'nenhum registro encontrado após INSERT');
  }

  // 3. chamadas — INSERT com professor_id
  const { error: chamErr } = await supabase
    .from('chamadas')
    .insert({ aluno_id: ALUNO_ID, professor_id: prof.id, disciplina_id: DISC_ID, turma_id: TURMA_ID, presenca: true, data_aula: HOJE });
  if (chamErr) err('INSERT chamadas (professor_id)', chamErr.message);
  else ok('INSERT chamadas (professor_id)');

  // 4. saidas_sala — INSERT (sem coluna de professor)
  const { data: saidaData, error: saidaErr } = await supabase
    .from('saidas_sala')
    .insert({ aluno_id: ALUNO_ID, disciplina_id: DISC_ID, turma_id: TURMA_ID, destino: 'Banheiro', hora_saida: new Date().toISOString(), status: 'Fora' })
    .select('id').single();
  if (saidaErr) err('INSERT saidas_sala', saidaErr.message);
  else ok('INSERT saidas_sala');

  // 4b. saidas_sala — UPDATE retorno
  if (saidaData?.id) {
    const { error: retErr } = await supabase
      .from('saidas_sala')
      .update({ hora_retorno: new Date().toISOString(), status: 'Retornou' })
      .eq('id', saidaData.id);
    if (retErr) err('UPDATE saidas_sala (retorno)', retErr.message);
    else ok('UPDATE saidas_sala (retorno)');
  }

  // RESULTADO FINAL
  console.log(`\n${'='.repeat(40)}`);
  console.log(`RESULTADO: ${passed} passou | ${failed} falhou`);
  if (failed === 0) console.log('🎉 TUDO FUNCIONANDO! Portal pronto para uso.');
  else console.log('⚠️  Ainda há itens a corrigir no Supabase.');
}

run().catch(console.error);
