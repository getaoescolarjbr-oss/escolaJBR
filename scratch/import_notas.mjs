import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── IDs DO BANCO ────────────────────────────────────────────────────────────
const TURMA_IDS = {
  '6º Ano A': 'bd1df917-640f-431e-81eb-4d8e88bdc6f5',
  '7º Ano A': '72fdf92e-4b47-4d97-8e02-c2e89548c80e',
  '8º Ano A': '41f4cff4-3a2d-4a44-8ace-3ed5156ce529',
  '9º Ano A': '9c14383d-8343-4b86-b2fe-ab2f4394b750',
  '1º Ano A': '40240976-446c-43a0-89ee-41ee204125ea',
  '1º Ano B': '2ddb923f-70ef-4be0-a90d-c7fca164530b',
  '1º Ano C': '37cefbab-86af-42ab-bf68-f6420c111d36',
  '1º Ano D': '74d7a7c2-7ec7-4124-9def-70a870a2301a',
  '2º Ano A': '97e90719-2c78-4839-89f1-29fa5b648d34',
  '2º Ano B': 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae',
  '2º Ano C': '689045b6-42fb-4b34-9dec-7f4bd2cd6d13',
  '3º Ano A': '3666567c-2f58-41ab-8d21-f1592e71812d',
  '3º Ano B': 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a',
};

const DISC_IDS = {
  'Apoio e Orientação de Estudos': '7a4aec82-a97d-4e03-bd59-211d2a53d336',
  'Arte': '88bb8abd-12d1-4245-868c-7fd84829a0e5',
  'Biologia': '44c05467-306c-4fb2-ba5c-500ada2334b4',
  'Ciências': '60aaff69-4879-4e61-9e9f-30b443866d0e',
  'Ciências Humanas e Sociedade': '8024bb67-8169-4cce-b1c5-789fc46e3203',
  'Ciências Naturais na Contemporaneidade': 'cac4014d-cab9-4606-a526-2d37d2940da8',
  'Educação Física': 'ff64b726-f719-4a5a-8f6b-e8f2c0e1944d',
  'Ensino Religioso': '656ab75f-8e00-4b97-a430-b45e31f781cb',
  'Estudo Orientado': '9c6cee4e-afa0-47c0-9cf2-188d588da747',
  'Filosofia': '0b717753-6253-4909-8c9d-381a4b656287',
  'Física': '01958ee9-3ecf-4e90-9318-54a44e748c42',
  'Geografia': 'f01e8067-0d0e-4ceb-9168-caabe16ea582',
  'História': '74db41d8-0a9e-416f-ab79-5a2dd264b572',
  'Laboratório de Linguas': '1cc4b63b-fbb8-4368-affd-a182a5ceb3a9',
  'Leitura e Produção Textual': '8c9ffde4-333d-46bc-b4b5-d4c343442e1d',
  'Letramento e Raciocínio Matemático': 'bf753cd6-67e3-46da-b235-f664a4fd1296',
  'Língua Espanhola': 'e94be167-cb07-473b-938b-e80665bfca84',
  'Língua Inglesa': '1e3550ad-cc84-458d-a30b-c13adce4598d',
  'Lingua Inglesa': '1e3550ad-cc84-458d-a30b-c13adce4598d',
  'Língua Portuguesa': 'ea9c7c1c-4d1c-4a55-accd-8467981dd6f4',
  'Língua Portuguesa - Literatura e Produção Textual': '3686b799-b002-439f-bfb7-68f61ca4a937',
  'Língua Portuguesa - RA': 'fd8bb29a-0a89-4c47-ac95-da1ce6db07b4',
  'Literatura Arte e Movimento': '6f93a67a-0f54-41ef-9a14-edd992413b5e',
  'Literatura, Arte e Movimento': '6f93a67a-0f54-41ef-9a14-edd992413b5e',
  'Matemática': 'dacd1f5f-eed5-470c-8fff-847953b660a1',
  'Matemática - Geometria': '67db400b-ed42-4a6f-993f-0ceed2f34928',
  'Matemática - RA': '7cdecd0f-abdb-456f-8bc6-53ebb5b00171',
  'Prática de Escrita e Estilo': '9431e88d-e766-4b5c-b28e-1dc425b2824f',
  'Química': 'cdbd47ad-a44c-4d71-9478-4588c9cfd318',
  'Sociologia': 'b7d5b8ae-1441-4d26-b943-50094510e006',
  'Tecnologia e Cidadania Digital': '44d8e59c-2e7c-4a96-bd4d-fdfc74481554',
  'Unidade Curricular I': '693cd451-8562-40b9-9dc4-ec74e8047f5f',
  'Unidade Curricular II': 'e822bd99-e08d-4181-b32a-0aab03625d2c',
  'Unidade Curricular III': '17cd5cc5-3a10-4152-aeb9-b00023332ec3',
  'Unidade Curricular IV': '6c3723af-9d70-4ff1-af63-7a2a7f6244f5',
};

// Disciplinas que NÃO devem ser importadas (SN, -, ou sem nota)
const SKIP_DISCS = new Set(['Faltas', 'Situação', 'Nome do Estudante', 'Turma']);

// bimestre_id = 5 representa "Nota Anual 2025" (convenção especial)
const BIMESTRE_ANUAL = 5;

function parseNota(val) {
  if (!val || val === '-' || val === 'SN' || val === '') return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return n;
}

async function main() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });
  console.log('✅ Autenticado\n');

  // 1. Limpar avaliação de teste criada anteriormente
  await supabase.from('avaliacoes').delete().eq('nome', 'Teste');
  console.log('🗑️  Avaliação de teste removida\n');

  // 2. Carregar dados dos alunos do banco para mapear nome → id
  const { data: alunosDB } = await supabase.from('alunos').select('id, nome, turma_id');
  const alunoMap = {}; // "turma_id|NOME UPPER" → id
  for (const a of (alunosDB || [])) {
    const key = `${a.turma_id}|${a.nome.trim().toUpperCase()}`;
    alunoMap[key] = a.id;
  }
  console.log(`📋 ${Object.keys(alunoMap).length} alunos carregados do banco\n`);

  // 3. Carregar parsed_grades_v2.json
  const grades = JSON.parse(fs.readFileSync('scratch/parsed_grades_v2.json', 'utf8'));
  console.log(`📊 ${grades.length} registros de notas a importar\n`);

  // 4. Identificar pares únicos turma+disciplina para criar avaliacoes
  const avalPairs = new Set();
  for (const row of grades) {
    const turmaId = TURMA_IDS[row['Turma']];
    if (!turmaId) continue;
    for (const [discName, val] of Object.entries(row)) {
      if (SKIP_DISCS.has(discName)) continue;
      const discId = DISC_IDS[discName];
      if (!discId) continue;
      const nota = parseNota(val);
      if (nota === null) continue;
      avalPairs.add(`${turmaId}|${discId}`);
    }
  }

  // 5. Criar avaliacoes em lote (Nota Anual 2025 por turma+disciplina)
  console.log(`🔨 Criando ${avalPairs.size} avaliações "Nota Anual 2025"...`);
  const avalRecords = [...avalPairs].map(pair => {
    const [turma_id, disciplina_id] = pair.split('|');
    return {
      professor_id: null,
      turma_id,
      disciplina_id,
      bimestre_id: BIMESTRE_ANUAL,
      nome: 'Nota Anual 2025',
      valor_maximo: 10,
      publicada: true,
    };
  });

  // Insert em chunks de 50
  const CHUNK = 50;
  const avalInserted = [];
  for (let i = 0; i < avalRecords.length; i += CHUNK) {
    const chunk = avalRecords.slice(i, i + CHUNK);
    const { data, error } = await supabase.from('avaliacoes').insert(chunk).select('id, turma_id, disciplina_id');
    if (error) {
      console.error(`  ❌ Erro ao inserir avaliacoes (chunk ${i}):`, error.message);
    } else {
      avalInserted.push(...data);
    }
  }
  console.log(`  ✅ ${avalInserted.length} avaliações criadas\n`);

  // Montar mapa: "turma_id|disc_id" → avaliacao_id
  const avalMap = {};
  for (const av of avalInserted) {
    avalMap[`${av.turma_id}|${av.disciplina_id}`] = av.id;
  }

  // 6. Montar registros de notas_avaliacoes
  const notasRecords = [];
  const unmatchedStudents = new Set();
  const unknownDiscs = new Set();
  let skippedRows = 0;

  for (const row of grades) {
    const turmaId = TURMA_IDS[row['Turma']];
    if (!turmaId) continue;

    const nomeAluno = (row['Nome do Estudante'] || '').trim().toUpperCase();
    const alunoKey = `${turmaId}|${nomeAluno}`;
    const alunoId = alunoMap[alunoKey];

    if (!alunoId) {
      unmatchedStudents.add(`${row['Turma']} | ${row['Nome do Estudante']}`);
      skippedRows++;
      continue;
    }

    for (const [discName, val] of Object.entries(row)) {
      if (SKIP_DISCS.has(discName)) continue;
      const discId = DISC_IDS[discName];
      if (!discId) {
        unknownDiscs.add(discName);
        continue;
      }
      const nota = parseNota(val);
      if (nota === null) continue;

      const avalKey = `${turmaId}|${discId}`;
      const avalId = avalMap[avalKey];
      if (!avalId) continue;

      notasRecords.push({
        avaliacao_id: avalId,
        aluno_id: alunoId,
        nota,
      });
    }
  }

  console.log(`📝 ${notasRecords.length} notas a inserir`);
  console.log(`⚠️  ${unmatchedStudents.size} alunos não encontrados no banco:`);
  for (const s of [...unmatchedStudents].slice(0, 20)) console.log(`   - ${s}`);
  if (unknownDiscs.size > 0) {
    console.log(`⚠️  Disciplinas não mapeadas: ${[...unknownDiscs].join(', ')}`);
  }

  // 7. Inserir notas em chunks
  console.log('\n🔨 Inserindo notas_avaliacoes...');
  let totalInserted = 0;
  let totalErrors = 0;
  for (let i = 0; i < notasRecords.length; i += CHUNK) {
    const chunk = notasRecords.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('notas_avaliacoes')
      .upsert(chunk, { onConflict: 'avaliacao_id,aluno_id' });
    if (error) {
      console.error(`  ❌ Chunk ${i}: ${error.message}`);
      totalErrors += chunk.length;
    } else {
      totalInserted += chunk.length;
    }
    if (i % 200 === 0) process.stdout.write('.');
  }
  console.log(`\n\n✅ ${totalInserted} notas inseridas com sucesso`);
  if (totalErrors > 0) console.log(`❌ ${totalErrors} notas falharam`);

  // 8. Resumo final
  const { data: finalCheck } = await supabase.from('notas_avaliacoes').select('id', { count: 'exact', head: true });
  console.log(`\n📊 Total de notas no banco agora: (verifique no dashboard)`);
  console.log('\n🎉 Importação concluída!');
}

main().catch(console.error);
