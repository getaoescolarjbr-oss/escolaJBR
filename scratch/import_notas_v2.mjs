/**
 * import_notas_v2.mjs
 * 
 * Imports 1st bimestre grades, student status, and absences into Supabase.
 * 
 * Strategy:
 * 1. Load all data from DB (alunos, alocacoes_v2, professores, disciplinas, turmas)
 * 2. For each student in parsed_grades_v2.json:
 *    a. Fuzzy-match by normalized name in the correct turma
 *    b. If not found → insert new student record
 *    c. Update status if different (e.g. "Transferido")
 * 3. For each (turma, disciplina) pair with a grade:
 *    a. Look up professor_id from alocacoes_v2
 *    b. Upsert a single avaliacao "Nota 1º Bimestre" (bimestre_id=1)
 * 4. Insert notas_avaliacoes records
 * 5. Insert chamadas records with presenca=false to represent absences
 *    (We use 1 record per absence per subject, distributed across school days)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── IDs DO BANCO ─────────────────────────────────────────────────────────────
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

// Fields to skip when iterating grade columns
const SKIP_FIELDS = new Set(['Faltas', 'Situação', 'Nome do Estudante', 'Turma']);

// Map spreadsheet "Situação" to database status values
const SITUACAO_MAP = {
  'Em curso': 'Ativo',
  'Transferido': 'Transferido',
  'Remanejado': 'Remanejado',
  'Cancelada': 'Cancelada',
  'Atestado': 'Atestado',
};

// 1st bimestre school days for absence distribution (2026 calendar)
// Approximate: February 17 - April 25, 2026 (Mon-Fri)
function getSchoolDays1stBimestre() {
  const days = [];
  const start = new Date('2026-02-17');
  const end = new Date('2026-04-25');
  let current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 5) { // Mon–Fri
      days.push(current.toISOString().slice(0, 10));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// Normalize name: uppercase, remove excess spaces, normalize accents for matching
function normalizeName(name) {
  return (name || '')
    .trim()
    .toUpperCase()
    .normalize('NFC')
    .replace(/\s+/g, ' ');
}

// Simple similarity: count matching tokens
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

async function insertChunked(table, records, chunkSize = 50, label = '') {
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`  ❌ ${label} chunk ${i}: ${error.message}`);
      errors += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, errors };
}

async function main() {
  // ─── AUTH ─────────────────────────────────────────────────────────────────
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });
  if (authErr) { console.error('Auth failed:', authErr.message); return; }
  console.log('✅ Authenticated\n');

  // ─── LOAD DB DATA ─────────────────────────────────────────────────────────
  console.log('📥 Loading database data...');
  
  const { data: alunosDB, error: alunosErr } = await supabase
    .from('alunos').select('id, nome, turma_id, status, aluno_numero');
  if (alunosErr) { console.error('Error loading alunos:', alunosErr.message); return; }
  
  const { data: allocations, error: allocErr } = await supabase
    .from('alocacoes_v2').select('professor_id, turma_id, disciplina_id');
  if (allocErr) { console.error('Error loading allocations:', allocErr.message); return; }

  console.log(`  📋 ${alunosDB.length} alunos loaded`);
  console.log(`  🔗 ${allocations.length} allocations loaded`);

  // Build maps
  // aluno map: "turma_id|NOME_NORMALIZADO" → aluno object
  const alunoMap = new Map();
  for (const a of alunosDB) {
    const key = `${a.turma_id}|${normalizeName(a.nome)}`;
    alunoMap.set(key, a);
  }

  // Build list by turma for fuzzy matching
  const alunosByTurma = new Map();
  for (const a of alunosDB) {
    if (!alunosByTurma.has(a.turma_id)) alunosByTurma.set(a.turma_id, []);
    alunosByTurma.get(a.turma_id).push(a);
  }

  // Allocation map: "turma_id|disciplina_id" → professor_id
  const allocMap = new Map();
  for (const alloc of allocations) {
    const key = `${alloc.turma_id}|${alloc.disciplina_id}`;
    if (!allocMap.has(key)) {
      allocMap.set(key, alloc.professor_id);
    }
  }

  // ─── LOAD GRADES DATA ─────────────────────────────────────────────────────
  const grades = JSON.parse(fs.readFileSync('scratch/parsed_grades_v2.json', 'utf8'));
  console.log(`\n📊 ${grades.length} student records to process\n`);

  const schoolDays = getSchoolDays1stBimestre();
  console.log(`📅 ${schoolDays.length} school days in 1st bimestre\n`);

  // ─── STEP 1: Ensure all students exist in DB ──────────────────────────────
  console.log('👤 Step 1: Matching/inserting students...');
  
  const studentIdMap = new Map(); // "spreadsheet_index" → aluno_id
  const newStudentsToInsert = [];
  const statusUpdates = [];
  const unmatchedStudents = [];
  
  // First pass: exact match or fuzzy match
  for (let idx = 0; idx < grades.length; idx++) {
    const row = grades[idx];
    const turmaId = TURMA_IDS[row['Turma']];
    if (!turmaId) {
      console.log(`  ⚠️ Unknown turma: ${row['Turma']}`);
      continue;
    }

    const nomeNorm = normalizeName(row['Nome do Estudante']);
    const exactKey = `${turmaId}|${nomeNorm}`;
    
    // 1. Exact match
    if (alunoMap.has(exactKey)) {
      const aluno = alunoMap.get(exactKey);
      studentIdMap.set(idx, aluno.id);
      
      // Check if status needs updating
      const desiredStatus = SITUACAO_MAP[row['Situação']] || 'Ativo';
      if (aluno.status !== desiredStatus) {
        statusUpdates.push({ id: aluno.id, status: desiredStatus });
      }
      continue;
    }

    // 2. Fuzzy match within same turma
    const turmaAlunos = alunosByTurma.get(turmaId) || [];
    let bestMatch = null;
    let bestScore = 0;
    for (const a of turmaAlunos) {
      const score = nameSimilarity(nomeNorm, a.nome);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = a;
      }
    }

    if (bestMatch && bestScore >= 0.7) {
      console.log(`  🔄 Fuzzy match (${(bestScore*100).toFixed(0)}%): "${row['Nome do Estudante']}" → "${bestMatch.nome}"`);
      studentIdMap.set(idx, bestMatch.id);
      
      const desiredStatus = SITUACAO_MAP[row['Situação']] || 'Ativo';
      if (bestMatch.status !== desiredStatus) {
        statusUpdates.push({ id: bestMatch.id, status: desiredStatus });
      }
    } else {
      // Will need to insert
      console.log(`  ➕ New student to insert: "${row['Nome do Estudante']}" (${row['Turma']})`);
      unmatchedStudents.push({ idx, row, turmaId });
    }
  }

  // Insert new students
  if (unmatchedStudents.length > 0) {
    console.log(`\n  Inserting ${unmatchedStudents.length} new students...`);
    for (const { idx, row, turmaId } of unmatchedStudents) {
      const desiredStatus = SITUACAO_MAP[row['Situação']] || 'Ativo';
      const turmaAlunos = alunosByTurma.get(turmaId) || [];
      const maxNumero = turmaAlunos.reduce((max, a) => Math.max(max, a.aluno_numero || 0), 0);
      
      const { data: inserted, error: insErr } = await supabase
        .from('alunos')
        .insert({
          nome: normalizeName(row['Nome do Estudante']),
          turma_id: turmaId,
          aluno_numero: maxNumero + 1,
          status: desiredStatus,
        })
        .select('id, nome, turma_id, status, aluno_numero')
        .single();
      
      if (insErr) {
        console.error(`  ❌ Failed to insert ${row['Nome do Estudante']}: ${insErr.message}`);
        continue;
      }
      
      console.log(`  ✅ Inserted: ${inserted.nome} (${row['Turma']})`);
      studentIdMap.set(idx, inserted.id);
      
      // Update local cache
      alunosByTurma.get(turmaId).push(inserted);
    }
  }

  // Apply status updates
  if (statusUpdates.length > 0) {
    console.log(`\n  Updating status for ${statusUpdates.length} students...`);
    for (const { id, status } of statusUpdates) {
      const { error } = await supabase.from('alunos').update({ status }).eq('id', id);
      if (error) console.error(`  ❌ Status update failed for ${id}: ${error.message}`);
    }
    console.log(`  ✅ Status updates done`);
  }

  console.log(`\n  ✅ ${studentIdMap.size}/${grades.length} students resolved\n`);

  // ─── STEP 2: Create/upsert evaluations ────────────────────────────────────
  console.log('📝 Step 2: Creating evaluations (Nota 1º Bimestre)...');

  // Collect unique (turma, disciplina) pairs that have actual grades
  const avalPairsMap = new Map(); // "turma_id|disc_id" → { turma_id, disciplina_id, professor_id }
  const missingAllocations = new Set();

  for (const row of grades) {
    const turmaId = TURMA_IDS[row['Turma']];
    if (!turmaId) continue;

    for (const [discName, val] of Object.entries(row)) {
      if (SKIP_FIELDS.has(discName)) continue;
      const discId = DISC_IDS[discName];
      if (!discId) continue;
      const nota = parseNota(val);
      if (nota === null) continue;

      const key = `${turmaId}|${discId}`;
      if (!avalPairsMap.has(key)) {
        const profId = allocMap.get(key);
        if (!profId) {
          missingAllocations.add(`${row['Turma']} | ${discName}`);
        }
        avalPairsMap.set(key, { turma_id: turmaId, disciplina_id: discId, professor_id: profId || null });
      }
    }
  }

  if (missingAllocations.size > 0) {
    console.log(`\n  ⚠️ Missing allocations for ${missingAllocations.size} combinations (professor_id will be null):`);
    for (const m of missingAllocations) console.log(`    - ${m}`);
  }

  // Check which (turma, disciplina, bimestre) already have "Nota 1º Bimestre" avaliacoes
  const { data: existingAvals } = await supabase
    .from('avaliacoes')
    .select('id, turma_id, disciplina_id, bimestre_id, nome')
    .eq('nome', 'Nota 1º Bimestre')
    .eq('bimestre_id', 1);

  const existingAvalMap = new Map();
  for (const av of (existingAvals || [])) {
    existingAvalMap.set(`${av.turma_id}|${av.disciplina_id}`, av.id);
  }

  // Insert new evaluations (skip existing)
  const avalToCreate = [];
  for (const [key, { turma_id, disciplina_id, professor_id }] of avalPairsMap) {
    if (!existingAvalMap.has(key)) {
      avalToCreate.push({
        turma_id,
        disciplina_id,
        professor_id,
        bimestre_id: 1,
        nome: 'Nota 1º Bimestre',
        valor_maximo: 10,
        publicada: true,
      });
    }
  }

  const newAvalIds = [];
  if (avalToCreate.length > 0) {
    console.log(`  Creating ${avalToCreate.length} new evaluations...`);
    const CHUNK = 50;
    for (let i = 0; i < avalToCreate.length; i += CHUNK) {
      const chunk = avalToCreate.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('avaliacoes')
        .insert(chunk)
        .select('id, turma_id, disciplina_id');
      if (error) {
        console.error(`  ❌ Error creating avaliacoes: ${error.message}`);
      } else {
        newAvalIds.push(...data);
        for (const av of data) {
          existingAvalMap.set(`${av.turma_id}|${av.disciplina_id}`, av.id);
        }
      }
    }
  }
  console.log(`  ✅ ${existingAvalMap.size} evaluations available (${newAvalIds.length} newly created)\n`);

  // ─── STEP 3: Insert notas_avaliacoes ──────────────────────────────────────
  console.log('🔢 Step 3: Building grade records...');
  const notasRecords = [];
  const unknownDiscs = new Set();

  for (let idx = 0; idx < grades.length; idx++) {
    const row = grades[idx];
    const turmaId = TURMA_IDS[row['Turma']];
    if (!turmaId) continue;
    
    const alunoId = studentIdMap.get(idx);
    if (!alunoId) continue;

    for (const [discName, val] of Object.entries(row)) {
      if (SKIP_FIELDS.has(discName)) continue;
      const discId = DISC_IDS[discName];
      if (!discId) {
        unknownDiscs.add(discName);
        continue;
      }
      const nota = parseNota(val);
      if (nota === null) continue;

      const avalKey = `${turmaId}|${discId}`;
      const avalId = existingAvalMap.get(avalKey);
      if (!avalId) continue;

      notasRecords.push({ avaliacao_id: avalId, aluno_id: alunoId, nota });
    }
  }

  if (unknownDiscs.size > 0) {
    console.log(`  ⚠️ Unknown disciplines (skipped): ${[...unknownDiscs].join(', ')}`);
  }
  console.log(`  📊 ${notasRecords.length} grade records to insert`);

  if (notasRecords.length > 0) {
    // First delete any existing grade records for these evaluations to avoid conflicts
    const avalIds = [...new Set(notasRecords.map(r => r.avaliacao_id))];
    console.log(`  🗑️ Clearing ${avalIds.length} existing evaluation grades...`);
    for (const avalId of avalIds) {
      await supabase.from('notas_avaliacoes').delete().eq('avaliacao_id', avalId);
    }

    const { inserted, errors } = await insertChunked('notas_avaliacoes', notasRecords, 50, 'notas');
    console.log(`  ✅ ${inserted} grades inserted${errors > 0 ? `, ❌ ${errors} errors` : ''}\n`);
  }

  // ─── STEP 4: Insert absences (chamadas with presenca=false) ───────────────
  console.log('📅 Step 4: Building absence records...');
  
  // Group absences per student per turma
  // We need the professor per turma+disciplina for chamadas
  // We'll pick a "primary" discipline for each absence to create the chamada
  // Strategy: distribute N absences evenly across school days, using 1 discipline per day
  
  const chamadasRecords = [];
  
  for (let idx = 0; idx < grades.length; idx++) {
    const row = grades[idx];
    const turmaId = TURMA_IDS[row['Turma']];
    if (!turmaId) continue;
    
    const alunoId = studentIdMap.get(idx);
    if (!alunoId) continue;
    
    const totalFaltas = parseInt(row['Faltas'], 10);
    if (!totalFaltas || totalFaltas <= 0) continue;

    // Find which disciplines this student has grades for (thus which professors taught them)
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

    // Distribute faltas across school days with a rotating discipline+professor
    const daysToUse = schoolDays.slice(0, totalFaltas);
    for (let i = 0; i < daysToUse.length; i++) {
      const { discId, profId } = discEntries[i % discEntries.length];
      chamadasRecords.push({
        aluno_id: alunoId,
        id_do_professor: profId,
        disciplina_id: discId,
        turma_id: turmaId,
        presenca: false,
        data_aula: daysToUse[i],
      });
    }
  }

  console.log(`  📊 ${chamadasRecords.length} absence records to insert`);

  if (chamadasRecords.length > 0) {
    // Clear existing chamadas for these students/dates to avoid duplicates
    const alunoIds = [...new Set(chamadasRecords.map(r => r.aluno_id))];
    console.log(`  🗑️ Clearing existing chamadas for ${alunoIds.length} students...`);
    for (const alunoId of alunoIds) {
      await supabase.from('chamadas').delete().eq('aluno_id', alunoId).eq('presenca', false);
    }

    const { inserted, errors } = await insertChunked('chamadas', chamadasRecords, 50, 'chamadas');
    console.log(`  ✅ ${inserted} absence records inserted${errors > 0 ? `, ❌ ${errors} errors` : ''}\n`);
  }

  // ─── FINAL SUMMARY ────────────────────────────────────────────────────────
  const { count: notasCount } = await supabase
    .from('notas_avaliacoes')
    .select('*', { count: 'exact', head: true });
  const { count: chamadasCount } = await supabase
    .from('chamadas')
    .select('*', { count: 'exact', head: true });
  const { count: avalCount } = await supabase
    .from('avaliacoes')
    .select('*', { count: 'exact', head: true });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 IMPORTAÇÃO CONCLUÍDA!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Avaliações no banco: ${avalCount}`);
  console.log(`  Notas no banco:      ${notasCount}`);
  console.log(`  Chamadas no banco:   ${chamadasCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
