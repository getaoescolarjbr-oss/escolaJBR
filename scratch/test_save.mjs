// Script de diagnóstico — testa cada operação de banco individualmente
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('\n=== 1. LOGIN ===');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'claysson.127082@edutec.sed.ms.gov.br',
    password: 'Goodm@n1'
  });
  if (authError) { console.error('ERRO LOGIN:', authError.message); process.exit(1); }
  console.log('Login OK. User ID:', authData.user.id);

  console.log('\n=== 2. BUSCAR PERFIL DO PROFESSOR ===');
  const { data: prof, error: profError } = await supabase
    .from('professores').select('id, nome, email').eq('user_id', authData.user.id).single();
  if (profError) console.error('ERRO PERFIL:', profError.message, profError.code);
  else console.log('Professor:', prof);

  console.log('\n=== 3. BUSCAR TURMAS ===');
  const { data: turmas, error: turmasError } = await supabase
    .from('alocacoes_v2').select('turma_id').eq('professor_id', prof?.id).limit(3);
  if (turmasError) console.error('ERRO TURMAS:', turmasError.message);
  else console.log('Turmas IDs:', turmas?.map(t => t.turma_id));

  const turmaId = turmas?.[0]?.turma_id;

  console.log('\n=== 4. BUSCAR DISCIPLINAS ===');
  const { data: discs, error: discError } = await supabase
    .from('alocacoes_v2').select('disciplina_id').eq('turma_id', turmaId).eq('professor_id', prof?.id).limit(3);
  if (discError) console.error('ERRO DISC:', discError.message);
  else console.log('Disciplinas IDs:', discs?.map(d => d.disciplina_id));

  const disciplinaId = discs?.[0]?.disciplina_id;
  const hoje = new Date().toISOString().split('T')[0];
  console.log('Testando com turma:', turmaId, '| disciplina:', disciplinaId, '| data:', hoje);

  console.log('\n=== 5. BUSCAR ALUNOS DA TURMA ===');
  const { data: alunos, error: alunosError } = await supabase
    .from('alunos').select('id, nome').eq('turma_id', turmaId).limit(3);
  if (alunosError) console.error('ERRO ALUNOS:', alunosError.message);
  else console.log('Alunos (3):', alunos?.map(a => a.id + ' | ' + a.nome));

  console.log('\n=== 6. SELECT em atividades_diárias ===');
  const { data: atExist, error: atSelError } = await supabase
    .from('atividades_di\u00e1rias')
    .select('id')
    .eq('id_do_professor', prof?.id)
    .eq('turma_id', turmaId)
    .eq('data', hoje)
    .maybeSingle();
  console.log('SELECT resultado:', { data: atExist?.id, error: atSelError?.message, code: atSelError?.code });

  console.log('\n=== 7. INSERT em atividades_diárias ===');
  const { data: atInsert, error: atInsertError } = await supabase
    .from('atividades_di\u00e1rias')
    .insert({
      id_do_professor: prof?.id,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      bimestre_id: 2,
      data: hoje,
      descricao: 'Teste de diagnostico'
    })
    .select('id')
    .single();
  console.log('INSERT atividades_diárias:', {
    data: atInsert?.id,
    error: atInsertError?.message,
    code: atInsertError?.code,
    details: atInsertError?.details,
    hint: atInsertError?.hint
  });

  const atividadeId = atExist?.id || atInsert?.id;
  console.log('Atividade ID para usar:', atividadeId);

  if (atividadeId && alunos?.[0]) {
    console.log('\n=== 8. INSERT em vistos_v2 ===');
    const { data: vistoData, error: vistoError } = await supabase
      .from('vistos_v2')
      .insert({
        atividade_id: atividadeId,
        aluno_id: alunos[0].id,
        valor: '.'
      })
      .select('id')
      .single();
    console.log('INSERT vistos_v2:', {
      data: vistoData?.id,
      error: vistoError?.message,
      code: vistoError?.code,
      details: vistoError?.details,
      hint: vistoError?.hint
    });

    console.log('\n=== 9. VERIFICAR SE VISTO FOI SALVO ===');
    const { data: checkVisto, error: checkError } = await supabase
      .from('vistos_v2').select('*').eq('atividade_id', atividadeId);
    console.log('Vistos no banco:', checkVisto, '| erro:', checkError?.message);
  } else {
    console.log('PULANDO testes de visto - sem atividade ID ou alunos');
  }

  console.log('\n=== 10. INSERT em chamadas ===');
  if (alunos?.[0]) {
    const { data: chamadaData, error: chamadaError } = await supabase
      .from('chamadas')
      .insert({
        aluno_id: alunos[0].id,
        id_do_professor: prof?.id,
        disciplina_id: disciplinaId,
        turma_id: turmaId,
        presenca: true,
        data_aula: hoje
      })
      .select('id')
      .single();
    console.log('INSERT chamadas:', {
      data: chamadaData?.id,
      error: chamadaError?.message,
      code: chamadaError?.code,
      details: chamadaError?.details
    });
  }

  console.log('\n=== DIAGNÓSTICO CONCLUÍDO ===');
}

run().catch(console.error);
