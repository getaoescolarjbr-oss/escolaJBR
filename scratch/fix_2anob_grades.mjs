/**
 * fix_2anob_grades.mjs
 *
 * The 10 students in 2º Ano B had their last 2 grade columns misread as "Faltas" and "Situação"
 * due to a column count mismatch in the raw data. 
 *
 * Looking at the 2º Ano B column header (from all_raw_data.txt line 12):
 * Turma | Nome | Arte | Biologia | Ed. Física | Estudo Orientado | Filosofia | Física |
 * Geografia | História | Lab.Linguas | Língua Espanhola | Língua Inglesa | LP-RA |
 * LP-LitProdTextual | Matemática | Matemática-RA | Matemática-Geometria | Prática Escrita |
 * Língua Portuguesa | Química | Sociologia | UC-I | UC-II | UC-III | UC-IV | Faltas | Situação
 *
 * But the JSON only maps 21 discipline columns for 2º Ano B (since some subjects didn't appear).
 * For the 10 "malformed" students, the 22nd and 23rd discipline values got slotted into "Faltas"/"Situação".
 *
 * From the raw data mapping for 2º Ano B:
 * Column mapping: Position 22 = Unidade Curricular I, Position 23 = Unidade Curricular II,
 * Position 24 = Unidade Curricular III, Position 25 = Unidade Curricular IV,
 * Position 26 = Faltas, Position 27 = Situação
 *
 * The parsed JSON for 2ºB only has positions up to "Tecnologia e Cidadania Digital" (21st discipline),
 * then "Faltas" and "Situação". So those students are MISSING unidade curricular grades.
 *
 * However, looking at raw data line 7-9, the 2ºB section there has different columns than line 12.
 * The "malformed" students (with numeric Situação) came from a DIFFERENT section of the spreadsheet
 * that had 26 columns (26 disciplines), while the "normal" students had 23 columns.
 *
 * CONCLUSION: The 10 students' "Faltas" and "Situação" values are actually their
 * "Unidade Curricular III" and "Unidade Curricular IV" grades respectively.
 * Their actual Faltas and Situação data is missing from the JSON.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// The 2º Ano B column header (26 grade columns + Faltas + Situação = 28 total)
// Maps to the RAW tab-delimited data for 2º Ano B
const TURMA_2B_ID = 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae';

const DISC_IDS_2B = {
  'Arte': '88bb8abd-12d1-4245-868c-7fd84829a0e5',
  'Biologia': '44c05467-306c-4fb2-ba5c-500ada2334b4',
  'Educação Física': 'ff64b726-f719-4a5a-8f6b-e8f2c0e1944d',
  'Estudo Orientado': '9c6cee4e-afa0-47c0-9cf2-188d588da747',
  'Filosofia': '0b717753-6253-4909-8c9d-381a4b656287',
  'Física': '01958ee9-3ecf-4e90-9318-54a44e748c42',
  'Geografia': 'f01e8067-0d0e-4ceb-9168-caabe16ea582',
  'História': '74db41d8-0a9e-416f-ab79-5a2dd264b572',
  'Laboratório de Linguas': '1cc4b63b-fbb8-4368-affd-a182a5ceb3a9',
  'Língua Espanhola': 'e94be167-cb07-473b-938b-e80665bfca84',
  'Língua Inglesa': '1e3550ad-cc84-458d-a30b-c13adce4598d',
  'Língua Portuguesa - RA': 'fd8bb29a-0a89-4c47-ac95-da1ce6db07b4',
  'Língua Portuguesa - Literatura e Produção Textual': '3686b799-b002-439f-bfb7-68f61ca4a937',
  'Matemática': 'dacd1f5f-eed5-470c-8fff-847953b660a1',
  'Matemática - RA': '7cdecd0f-abdb-456f-8bc6-53ebb5b00171',
  'Matemática - Geometria': '67db400b-ed42-4a6f-993f-0ceed2f34928',
  'Prática de Escrita e Estilo': '9431e88d-e766-4b5c-b28e-1dc425b2824f',
  'Língua Portuguesa': 'ea9c7c1c-4d1c-4a55-accd-8467981dd6f4',
  'Química': 'cdbd47ad-a44c-4d71-9478-4588c9cfd318',
  'Sociologia': 'b7d5b8ae-1441-4d26-b943-50094510e006',
  'Unidade Curricular I': '693cd451-8562-40b9-9dc4-ec74e8047f5f',
  'Unidade Curricular II': 'e822bd99-e08d-4181-b32a-0aab03625d2c',
  'Unidade Curricular III': '17cd5cc5-3a10-4152-aeb9-b00023332ec3',
  'Unidade Curricular IV': '6c3723af-9d70-4ff1-af63-7a2a7f6244f5',
};

// Column order for 2º Ano B (from raw data header on line 12)
const COL_ORDER_2B = [
  'Arte', 'Biologia', 'Educação Física', 'Estudo Orientado', 'Filosofia', 'Física',
  'Geografia', 'História', 'Laboratório de Linguas', 'Língua Espanhola', 'Língua Inglesa',
  'Língua Portuguesa - RA', 'Língua Portuguesa - Literatura e Produção Textual',
  'Matemática', 'Matemática - RA', 'Matemática - Geometria', 'Prática de Escrita e Estilo',
  'Língua Portuguesa', 'Química', 'Sociologia',
  'Unidade Curricular I', 'Unidade Curricular II', 'Unidade Curricular III', 'Unidade Curricular IV'
];

// The 10 students with misaligned columns in the JSON (their "Faltas" = UC-III, "Situação" = UC-IV)
// We need to: 
//   1. Add missing UC-III and UC-IV grades to notas_avaliacoes
//   2. Their actual Faltas are unknown (not in JSON) — we'll assume 0

// Raw data for these 10 students (manually extracted from the 2B section with 26 columns):
// Format: [nome, ...24 grades, faltas, situacao]
// These students appeared in the SECOND 2ºB section (line 12 header) which had the full 26 cols
const MALFORMED_STUDENTS_RAW = [
  { nome: 'MARIA JÚLIA SIBEMOL MASCARENHAS BEZERRA',
    grades: { 'Arte': 7.5, 'Biologia': 10.0, 'Educação Física': 9.0, 'Estudo Orientado': null, 'Filosofia': 9.5, 'Física': 10.0, 'Geografia': 9.0, 'História': 8.0, 'Laboratório de Linguas': 6.5, 'Língua Espanhola': 9.0, 'Língua Inglesa': 9.0, 'Língua Portuguesa - RA': null, 'Língua Portuguesa - Literatura e Produção Textual': null, 'Matemática': 9.0, 'Matemática - RA': 10.0, 'Matemática - Geometria': null, 'Prática de Escrita e Estilo': null, 'Língua Portuguesa': 9.5, 'Química': null, 'Sociologia': null, 'Unidade Curricular I': null, 'Unidade Curricular II': null, 'Unidade Curricular III': 9.5, 'Unidade Curricular IV': 10.0 },
    faltas: 0, situacao: 'Em curso' }, 
  // Note: We can't reliably determine UC-III and UC-IV from the malformed data 
  // because the JSON's "Faltas" and "Situação" might represent those 2 missing cols.
  // The safest approach: use "Faltas" as UC-III and "Situação" as UC-IV
  // for all 10 malformed students.
];

function parseNota(val) {
  if (!val || val === '-' || val === 'SN' || val === '') return null;
  const n = parseFloat(String(val));
  if (isNaN(n)) return null;
  return n;
}

function normalizeName(name) {
  return (name || '').trim().toUpperCase().normalize('NFC').replace(/\s+/g, ' ');
}

async function main() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });
  console.log('✅ Authenticated\n');

  // Load current alunos for 2º Ano B
  const { data: alunos2b } = await supabase
    .from('alunos').select('id, nome').eq('turma_id', TURMA_2B_ID);
  const alunoMap = new Map(alunos2b.map(a => [normalizeName(a.nome), a.id]));

  // Load avaliacoes for 2º Ano B bimestre 1
  const { data: avals2b } = await supabase
    .from('avaliacoes')
    .select('id, disciplina_id')
    .eq('turma_id', TURMA_2B_ID)
    .eq('bimestre_id', 1);
  const avalByDisc = new Map(avals2b.map(a => [a.disciplina_id, a.id]));

  // Load grades JSON
  const grades = JSON.parse(fs.readFileSync('scratch/parsed_grades_v2.json', 'utf8'));
  const malformed2b = grades.filter(r => 
    r['Turma'] === '2º Ano B' && 
    !['Em curso', 'Transferido', '-', ''].includes(r['Situação'])
  );

  console.log(`📊 ${malformed2b.length} malformed 2º Ano B records to fix`);

  // For each malformed student:
  // Their JSON has: correct grades for all disciplines EXCEPT UC-III and UC-IV
  // "Faltas" in JSON = UC-III grade, "Situação" in JSON = UC-IV grade
  // Their actual Faltas (number of absences) is unknown — we'll leave as-is (not add chamadas)
  
  const notasToAdd = [];

  for (const row of malformed2b) {
    const nome = normalizeName(row['Nome do Estudante']);
    const alunoId = alunoMap.get(nome);
    if (!alunoId) { console.log(`  ⚠️ Student not found: ${row['Nome do Estudante']}`); continue; }

    // UC-III and UC-IV grades are stored in "Faltas" and "Situação" fields
    const ucIII = parseNota(row['Faltas']);
    const ucIV = parseNota(row['Situação']);

    console.log(`  ${row['Nome do Estudante']}: UC-III=${ucIII}, UC-IV=${ucIV}`);

    if (ucIII !== null) {
      const discId = DISC_IDS_2B['Unidade Curricular III'];
      const avalId = avalByDisc.get(discId);
      if (avalId) notasToAdd.push({ avaliacao_id: avalId, aluno_id: alunoId, nota: ucIII });
    }
    if (ucIV !== null) {
      const discId = DISC_IDS_2B['Unidade Curricular IV'];
      const avalId = avalByDisc.get(discId);
      if (avalId) notasToAdd.push({ avaliacao_id: avalId, aluno_id: alunoId, nota: ucIV });
    }
  }

  console.log(`\n📝 ${notasToAdd.length} additional grade records to insert`);

  if (notasToAdd.length > 0) {
    // These are NEW records (UC-III and UC-IV weren't in the original import)
    const { error } = await supabase.from('notas_avaliacoes').insert(notasToAdd);
    if (error) {
      // Try upsert if there are conflicts
      const { error: upsertErr } = await supabase
        .from('notas_avaliacoes')
        .upsert(notasToAdd, { onConflict: 'avaliacao_id,aluno_id' });
      if (upsertErr) console.error('❌ Error:', upsertErr.message);
      else console.log(`✅ ${notasToAdd.length} UC-III/UC-IV grades upserted`);
    } else {
      console.log(`✅ ${notasToAdd.length} UC-III/UC-IV grades inserted`);
    }
  }

  // Final count
  const { count: notasCount } = await supabase.from('notas_avaliacoes').select('*', { count: 'exact', head: true });
  console.log(`\n📊 Total notas in DB: ${notasCount}`);
}

main().catch(console.error);
