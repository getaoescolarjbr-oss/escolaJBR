/**
 * fix_missing_student_grades.mjs
 *
 * Run this AFTER manually inserting 3 students via Supabase SQL Editor:
 * - LUCAS JEFERSON FLORENCIO COSTA (2º Ano B)
 * - PEDRO HENRIQUE SANTOS PEREIRA (3º Ano B)  
 * - VINICIUS FRÔES DA SILVA (3º Ano B)
 *
 * This script will:
 * 1. Find the newly inserted students by name
 * 2. Insert their grades from parsed_grades_v2.json into notas_avaliacoes
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TURMA_IDS = {
  '2º Ano B': 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae',
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

const SKIP_FIELDS = new Set(['Faltas', 'Situação', 'Nome do Estudante', 'Turma']);

const TARGET_STUDENTS = [
  { nome: 'LUCAS JEFERSON FLORENCIO COSTA', turma: '2º Ano B' },
  { nome: 'PEDRO HENRIQUE SANTOS PEREIRA', turma: '3º Ano B' },
  { nome: 'VINICIUS FRÔES DA SILVA', turma: '3º Ano B' },
];

function normalizeName(name) {
  return (name || '').trim().toUpperCase().normalize('NFC').replace(/\s+/g, ' ');
}

function parseNota(val) {
  if (!val || val === '-' || val === 'SN' || val === '') return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return n;
}

async function main() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });
  console.log('✅ Authenticated\n');

  const grades = JSON.parse(fs.readFileSync('scratch/parsed_grades_v2.json', 'utf8'));

  // Load avaliacoes for the target turmas
  const { data: avals } = await supabase
    .from('avaliacoes')
    .select('id, turma_id, disciplina_id')
    .in('turma_id', Object.values(TURMA_IDS))
    .eq('bimestre_id', 1)
    .eq('nome', 'Nota 1º Bimestre');
  
  const avalMap = new Map(avals.map(a => [`${a.turma_id}|${a.disciplina_id}`, a.id]));
  console.log(`📝 ${avals.length} evaluations found\n`);

  const notasToInsert = [];

  for (const { nome, turma } of TARGET_STUDENTS) {
    const turmaId = TURMA_IDS[turma];

    // Find student in DB
    const { data: students } = await supabase
      .from('alunos')
      .select('id, nome')
      .eq('turma_id', turmaId)
      .ilike('nome', `%${nome.split(' ')[0]}%`);

    const student = students?.find(s => normalizeName(s.nome) === normalizeName(nome));
    
    if (!student) {
      console.log(`❌ Student not found in DB: ${nome} (${turma})`);
      console.log('   Available students matching first name:');
      (students || []).forEach(s => console.log(`   - ${s.nome} (${s.id})`));
      continue;
    }

    console.log(`✅ Found: ${student.nome} (id: ${student.id})`);

    // Find grade row
    const gradeRow = grades.find(r => 
      r['Turma'] === turma && 
      normalizeName(r['Nome do Estudante']) === normalizeName(nome)
    );

    if (!gradeRow) {
      console.log(`  ⚠️ No grade row found in JSON for ${nome}`);
      continue;
    }

    let gradesAdded = 0;
    for (const [discName, val] of Object.entries(gradeRow)) {
      if (SKIP_FIELDS.has(discName)) continue;
      const discId = DISC_IDS[discName];
      if (!discId) continue;
      const nota = parseNota(val);
      if (nota === null) continue;

      const avalKey = `${turmaId}|${discId}`;
      const avalId = avalMap.get(avalKey);
      if (!avalId) continue;

      notasToInsert.push({ avaliacao_id: avalId, aluno_id: student.id, nota });
      gradesAdded++;
    }
    console.log(`  → ${gradesAdded} grade records prepared`);
  }

  if (notasToInsert.length > 0) {
    console.log(`\n🔢 Inserting ${notasToInsert.length} grade records...`);
    const { error } = await supabase.from('notas_avaliacoes').insert(notasToInsert);
    if (error) {
      // Try upsert
      const { error: uErr } = await supabase
        .from('notas_avaliacoes')
        .upsert(notasToInsert, { onConflict: 'avaliacao_id,aluno_id' });
      if (uErr) console.error('❌ Error:', uErr.message);
      else console.log(`✅ ${notasToInsert.length} grades upserted`);
    } else {
      console.log(`✅ ${notasToInsert.length} grades inserted`);
    }
  }

  const { count: total } = await supabase.from('notas_avaliacoes').select('*', { count: 'exact', head: true });
  console.log(`\n📊 Total notas in DB: ${total}`);
}

main().catch(console.error);
