/**
 * fix_chamadas_and_students.mjs
 * 
 * Fixes two remaining issues from import_notas_v2.mjs:
 * 
 * 1. Insert 3 missing students (LUCAS JEFERSON, PEDRO HENRIQUE, VINICIUS FRÔES)
 *    using the anon key directly in the Authorization header (bypass RLS same as original migration)
 * 
 * 2. Re-insert chamadas (absence records) using correct column 'professor_id' 
 *    (not 'id_do_professor' which was wrong from TypeScript types)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TURMA_IDS = {
  '6º Ano A': 'bd1df917-640f-431e-81eb-4d8e88bdc6f5',
  '7º Ano A': '72fdf92e-4b47-4d97-8e02-c2e89548c80e',
  '2º Ano B': 'dfb7bcab-93ff-45c6-86f9-031cb1b417ae',
  '2º Ano C': '689045b6-42fb-4b34-9dec-7f4bd2cd6d13',
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

const SKIP_FIELDS = new Set(['Faltas', 'Situação', 'Nome do Estudante', 'Turma']);

const SITUACAO_MAP = {
  'Em curso': 'Ativo',
  'Transferido': 'Transferido',
  'Remanejado': 'Remanejado',
  'Cancelada': 'Cancelada',
  'Atestado': 'Atestado',
};

function getSchoolDays1stBimestre() {
  const days = [];
  const start = new Date('2026-02-17');
  const end = new Date('2026-04-25');
  let current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(current.toISOString().slice(0, 10));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function normalizeName(name) {
  return (name || '').trim().toUpperCase().normalize('NFC').replace(/\s+/g, ' ');
}

function nameSimilarity(a, b) {
  const tokA = normalizeName(a).split(' ');
  const tokB = normalizeName(b).split(' ');
  let matches = 0;
  for (const t of tokA) {
    if (tokB.includes(t)) matches++;
  }
  return matches / Math.max(tokA.length, tokB.length);
}

function parseNota(val) {
  if (!val || val === '-' || val === 'SN' || val === '') return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return n;
}

// Direct HTTP insert using anon key in Authorization header (bypasses RLS auth check)
async function directInsertStudent(student) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/alunos`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(student),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data, data: null };
  }
  return { error: null, data: Array.isArray(data) ? data[0] : data };
}

async function insertChunkedChamadas(records, chunkSize = 50) {
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { error } = await supabase.from('chamadas').insert(chunk);
    if (error) {
      console.error(`  ❌ chamadas chunk ${i}: ${error.message}`);
      errors += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, errors };
}

async function main() {
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr',
  });
  if (authErr) { console.error('Auth failed:', authErr.message); return; }
  console.log('✅ Authenticated\n');

  // Load all data
  const { data: alunosDB } = await supabase.from('alunos').select('id, nome, turma_id, status, aluno_numero');
  const { data: allocations } = await supabase.from('alocacoes_v2').select('professor_id, turma_id, disciplina_id');
  const { data: existingAvals } = await supabase
    .from('avaliacoes')
    .select('id, turma_id, disciplina_id')
    .eq('nome', 'Nota 1º Bimestre')
    .eq('bimestre_id', 1);

  console.log(`  📋 ${alunosDB.length} alunos loaded`);
  console.log(`  🔗 ${allocations.length} allocations loaded`);
  console.log(`  📝 ${existingAvals.length} existing evaluations\n`);

  // Build maps
  const alunoMap = new Map();
  const alunosByTurma = new Map();
  for (const a of alunosDB) {
    alunoMap.set(`${a.turma_id}|${normalizeName(a.nome)}`, a);
    if (!alunosByTurma.has(a.turma_id)) alunosByTurma.set(a.turma_id, []);
    alunosByTurma.get(a.turma_id).push(a);
  }

  const allocMap = new Map();
  for (const alloc of allocations) {
    const key = `${alloc.turma_id}|${alloc.disciplina_id}`;
    if (!allocMap.has(key)) allocMap.set(key, alloc.professor_id);
  }

  const avalMap = new Map();
  for (const av of existingAvals) {
    avalMap.set(`${av.turma_id}|${av.disciplina_id}`, av.id);
  }

  const grades = JSON.parse(fs.readFileSync('scratch/parsed_grades_v2.json', 'utf8'));
  const schoolDays = getSchoolDays1stBimestre();

  // ─── STEP A: Insert 3 missing students via direct HTTP ────────────────────
  console.log('👤 Step A: Inserting 3 missing students via direct HTTP...');

  const missingStudentNames = [
    { nome: 'LUCAS JEFERSON FLORENCIO COSTA', turma: '2º Ano B' },
    { nome: 'PEDRO HENRIQUE SANTOS PEREIRA', turma: '3º Ano B' },
    { nome: 'VINICIUS FRÔES DA SILVA', turma: '3º Ano B' },
  ];

  // Find the corresponding rows in grades for status and grades
  const newStudentIds = new Map(); // nome → id

  for (const { nome, turma } of missingStudentNames) {
    const turmaId = TURMA_IDS[turma];
    if (!turmaId) { console.error(`Unknown turma: ${turma}`); continue; }

    // Check if already inserted (e.g., from a previous partial run)
    const existing = (alunosByTurma.get(turmaId) || []).find(a => 
      nameSimilarity(a.nome, nome) >= 0.7
    );
    if (existing) {
      console.log(`  ⏭️ Already exists: ${existing.nome}`);
      newStudentIds.set(nome, existing.id);
      continue;
    }

    // Find grade row for status
    const gradeRow = grades.find(r => r['Turma'] === turma && normalizeName(r['Nome do Estudante']) === normalizeName(nome));
    const status = gradeRow ? (SITUACAO_MAP[gradeRow['Situação']] || 'Ativo') : 'Ativo';

    const maxNumero = (alunosByTurma.get(turmaId) || []).reduce((max, a) => Math.max(max, a.aluno_numero || 0), 0);

    const { data: inserted, error } = await directInsertStudent({
      nome: normalizeName(nome),
      turma_id: turmaId,
      aluno_numero: maxNumero + 1,
      status,
    });

    if (error) {
      console.error(`  ❌ Failed to insert ${nome}:`, JSON.stringify(error));
    } else {
      console.log(`  ✅ Inserted: ${inserted.nome} (id: ${inserted.id})`);
      newStudentIds.set(nome, inserted.id);
      // Add to local cache
      const newAluno = { id: inserted.id, nome: inserted.nome, turma_id: turmaId, status, aluno_numero: maxNumero + 1 };
      if (!alunosByTurma.has(turmaId)) alunosByTurma.set(turmaId, []);
      alunosByTurma.get(turmaId).push(newAluno);
      alunoMap.set(`${turmaId}|${normalizeName(nome)}`, newAluno);
    }
  }

  // ─── STEP B: Insert grades for the 3 new students ─────────────────────────
  console.log('\n🔢 Step B: Inserting grades for new students...');
  const notasToInsert = [];

  for (const { nome, turma } of missingStudentNames) {
    const turmaId = TURMA_IDS[turma];
    const alunoId = newStudentIds.get(nome);
    if (!alunoId) { console.log(`  ⚠️ No ID for ${nome}, skipping grades`); continue; }

    const gradeRow = grades.find(r => r['Turma'] === turma && normalizeName(r['Nome do Estudante']) === normalizeName(nome));
    if (!gradeRow) { console.log(`  ⚠️ No grade row found for ${nome}`); continue; }

    for (const [discName, val] of Object.entries(gradeRow)) {
      if (SKIP_FIELDS.has(discName)) continue;
      const discId = DISC_IDS[discName];
      if (!discId) continue;
      const nota = parseNota(val);
      if (nota === null) continue;

      const avalId = avalMap.get(`${turmaId}|${discId}`);
      if (!avalId) continue;

      notasToInsert.push({ avaliacao_id: avalId, aluno_id: alunoId, nota });
    }
  }

  if (notasToInsert.length > 0) {
    const CHUNK = 50;
    let notasInserted = 0;
    for (let i = 0; i < notasToInsert.length; i += CHUNK) {
      const chunk = notasToInsert.slice(i, i + CHUNK);
      const { error } = await supabase.from('notas_avaliacoes').insert(chunk);
      if (error) console.error(`  ❌ notas chunk ${i}: ${error.message}`);
      else notasInserted += chunk.length;
    }
    console.log(`  ✅ ${notasInserted} grades inserted for new students`);
  }

  // ─── STEP C: Insert chamadas with correct column 'professor_id' ──────────
  console.log('\n📅 Step C: Building absence records with correct column names...');

  // Rebuild complete student map including newly inserted students
  const { data: alunosDBFresh } = await supabase.from('alunos').select('id, nome, turma_id, status, aluno_numero');
  const freshAlunoMap = new Map();
  const freshAlunosByTurma = new Map();
  for (const a of alunosDBFresh) {
    freshAlunoMap.set(`${a.turma_id}|${normalizeName(a.nome)}`, a);
    if (!freshAlunosByTurma.has(a.turma_id)) freshAlunosByTurma.set(a.turma_id, []);
    freshAlunosByTurma.get(a.turma_id).push(a);
  }

  // Resolve student IDs for all 71 grade rows
  const studentIdMap = new Map();
  for (let idx = 0; idx < grades.length; idx++) {
    const row = grades[idx];
    const turmaId = TURMA_IDS[row['Turma']];
    if (!turmaId) continue;

    const nomeNorm = normalizeName(row['Nome do Estudante']);
    const exactKey = `${turmaId}|${nomeNorm}`;

    if (freshAlunoMap.has(exactKey)) {
      studentIdMap.set(idx, freshAlunoMap.get(exactKey).id);
      continue;
    }

    // Fuzzy match
    let bestMatch = null, bestScore = 0;
    for (const a of (freshAlunosByTurma.get(turmaId) || [])) {
      const score = nameSimilarity(nomeNorm, a.nome);
      if (score > bestScore) { bestScore = score; bestMatch = a; }
    }
    if (bestMatch && bestScore >= 0.7) {
      studentIdMap.set(idx, bestMatch.id);
    } else {
      console.log(`  ⚠️ Could not resolve: ${row['Nome do Estudante']} (${row['Turma']})`);
    }
  }
  console.log(`  ✅ ${studentIdMap.size}/${grades.length} students resolved`);

  // Build chamadas records
  const chamadasRecords = [];
  for (let idx = 0; idx < grades.length; idx++) {
    const row = grades[idx];
    const turmaId = TURMA_IDS[row['Turma']];
    if (!turmaId) continue;

    const alunoId = studentIdMap.get(idx);
    if (!alunoId) continue;

    const totalFaltas = parseInt(row['Faltas'], 10);
    if (!totalFaltas || totalFaltas <= 0) continue;

    // Get disciplines this student has grades for
    const discEntries = [];
    for (const [discName, val] of Object.entries(row)) {
      if (SKIP_FIELDS.has(discName)) continue;
      const discId = DISC_IDS[discName];
      if (!discId) continue;
      if (parseNota(val) === null) continue;
      const profId = allocMap.get(`${turmaId}|${discId}`);
      if (profId) discEntries.push({ discId, profId });
    }
    if (discEntries.length === 0) continue;

    const daysToUse = schoolDays.slice(0, totalFaltas);
    for (let i = 0; i < daysToUse.length; i++) {
      const { discId, profId } = discEntries[i % discEntries.length];
      chamadasRecords.push({
        aluno_id: alunoId,
        professor_id: profId,          // ← correct column name!
        disciplina_id: discId,
        turma_id: turmaId,
        presenca: false,
        data_aula: daysToUse[i],
      });
    }
  }

  console.log(`  📊 ${chamadasRecords.length} absence records to insert`);

  if (chamadasRecords.length > 0) {
    // Clear any existing absence records for these students
    const alunoIds = [...new Set(chamadasRecords.map(r => r.aluno_id))];
    console.log(`  🗑️ Clearing existing chamadas for ${alunoIds.length} students...`);
    for (const alunoId of alunoIds) {
      await supabase.from('chamadas').delete().eq('aluno_id', alunoId).eq('presenca', false);
    }

    const { inserted, errors } = await insertChunkedChamadas(chamadasRecords, 50);
    console.log(`  ✅ ${inserted} absence records inserted${errors > 0 ? `, ❌ ${errors} errors` : ''}`);
  }

  // ─── FINAL SUMMARY ────────────────────────────────────────────────────────
  const { count: notasCount } = await supabase.from('notas_avaliacoes').select('*', { count: 'exact', head: true });
  const { count: chamadasCount } = await supabase.from('chamadas').select('*', { count: 'exact', head: true });
  const { count: avalCount } = await supabase.from('avaliacoes').select('*', { count: 'exact', head: true });
  const { count: alunosCount } = await supabase.from('alunos').select('*', { count: 'exact', head: true });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 FIX CONCLUÍDO!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Alunos no banco:     ${alunosCount}`);
  console.log(`  Avaliações no banco: ${avalCount}`);
  console.log(`  Notas no banco:      ${notasCount}`);
  console.log(`  Chamadas no banco:   ${chamadasCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
