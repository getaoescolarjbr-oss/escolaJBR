import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  // Autenticar como coordenador
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  if (authError) { console.error('Erro de autenticação:', authError.message); return; }
  console.log('✅ Autenticado com sucesso');

  // PASSO 1: Buscar atas sem join (contorna PGRST200)
  const { data: atasData, error: atasError } = await supabase
    .from('atas_alunos')
    .select('*')
    .order('numero_sequencial', { ascending: false });

  if (atasError) { console.error('❌ Erro ao buscar atas:', atasError.message); return; }
  console.log(`✅ Atas encontradas: ${atasData.length}`);

  if (atasData.length === 0) { console.log('ℹ️  Sem atas para processar.'); return; }

  // PASSO 2: Coletar IDs únicos de alunos
  const alunoIds = [...new Set(atasData.map(a => a.aluno_id).filter(Boolean))];
  console.log(`ℹ️  IDs de alunos únicos: ${alunoIds.length}`);

  // PASSO 3: Buscar dados dos alunos com turma
  const { data: alunosData, error: alunosError } = await supabase
    .from('alunos')
    .select('id, nome, turma_id, turmas(nome)')
    .in('id', alunoIds);

  if (alunosError) { console.error('❌ Erro ao buscar alunos:', alunosError.message); return; }
  console.log(`✅ Alunos encontrados: ${alunosData.length}`);

  // PASSO 4: Montar mapa de alunos
  const alunoMap = {};
  (alunosData || []).forEach(al => {
    alunoMap[al.id] = { id: al.id, nome: al.nome, turmas: al.turmas || null };
  });

  // PASSO 5: Join manual
  const atasComAlunos = atasData.map(ata => ({
    ...ata,
    alunos: alunoMap[ata.aluno_id] || null,
  }));

  console.log('\n--- Primeiras 3 atas com join manual ---');
  atasComAlunos.slice(0, 3).forEach(ata => {
    console.log(`  Ata #${String(ata.numero_sequencial).padStart(3,'0')} | Aluno: ${ata.alunos?.nome || 'SEM DADOS'} | Turma: ${ata.alunos?.turmas?.nome || 'N/A'} | Status: ${ata.imagem_assinatura_url ? 'Assinada' : 'Pendente'}`);
  });

  const semAluno = atasComAlunos.filter(a => !a.alunos);
  if (semAluno.length > 0) {
    console.warn(`⚠️  ${semAluno.length} ata(s) sem aluno correspondente (aluno_id pode estar incorreto).`);
  } else {
    console.log('✅ Todos os registros com dados de aluno corretamente vinculados!');
  }
}

run().catch(console.error);
