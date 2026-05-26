import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  // 1. Fetch all schedules
  const { data: schedules } = await supabase.from('horarios').select('*');
  console.log(`Total schedules: ${schedules?.length || 0}`);

  // 2. Fetch all disciplines
  const { data: disciplines } = await supabase.from('disciplinas').select('*');
  const disciplineMap = new Map();
  disciplines.forEach(d => {
    disciplineMap.set(d.nome.toLowerCase().trim(), d.id);
  });

  // 3. Fetch all current allocations
  const { data: allocations } = await supabase.from('alocacoes_v2').select('*');
  const existingAllocationsSet = new Set(
    (allocations || []).map(a => `${a.professor_id}_${a.turma_id}_${a.disciplina_id}`)
  );
  console.log(`Total existing allocations in alocacoes_v2: ${existingAllocationsSet.size}`);

  // 4. Group unique (professor, turma, disciplina_nome) from schedules
  const uniqueScheduleAllocations = new Map();
  schedules.forEach(h => {
    const key = `${h.professor_id}_${h.turma_id}_${h.disciplina_nome.trim()}`;
    if (!uniqueScheduleAllocations.has(key)) {
      uniqueScheduleAllocations.set(key, {
        professor_id: h.professor_id,
        turma_id: h.turma_id,
        disciplina_nome: h.disciplina_nome.trim()
      });
    }
  });
  console.log(`Unique combinations of (Professor, Turma, Discipline Name) in schedules: ${uniqueScheduleAllocations.size}`);

  // 5. Match and count
  let matchCount = 0;
  let missingDisciplineCount = 0;
  let alreadyAllocatedCount = 0;
  let toBeAllocated = [];

  for (const [key, value] of uniqueScheduleAllocations.entries()) {
    const discNameLower = value.disciplina_nome.toLowerCase();
    const discId = disciplineMap.get(discNameLower);

    if (!discId) {
      missingDisciplineCount++;
      console.log(`[ALERT] No exact discipline found for schedule name: "${value.disciplina_nome}"`);
      continue;
    }

    const allocKey = `${value.professor_id}_${value.turma_id}_${discId}`;
    if (existingAllocationsSet.has(allocKey)) {
      alreadyAllocatedCount++;
    } else {
      toBeAllocated.push({
        professor_id: value.professor_id,
        turma_id: value.turma_id,
        disciplina_id: discId,
        _debug_nome: value.disciplina_nome
      });
    }
    matchCount++;
  }

  console.log('\n--- MATCHING RESULTS ---');
  console.log(`Matched with disciplines table: ${matchCount}`);
  console.log(`Unmatched / Missing in disciplines table: ${missingDisciplineCount}`);
  console.log(`Already allocated in database: ${alreadyAllocatedCount}`);
  console.log(`To be allocated (new allocations to create): ${toBeAllocated.length}`);

  if (toBeAllocated.length > 0) {
    console.log('\nSample of new allocations to be created:');
    console.dir(toBeAllocated.slice(0, 5), { depth: null });
  }
}

run().catch(console.error);
