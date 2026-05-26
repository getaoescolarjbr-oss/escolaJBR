import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeStr(str) {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'gestaoescolarjbr@gmail.com',
    password: 'Gest@ojbr'
  });

  const { data: schedules } = await supabase.from('horarios').select('*');
  const { data: disciplines } = await supabase.from('disciplinas').select('*');

  // Map normalized name to ID
  const discMap = new Map();
  disciplines.forEach(d => {
    discMap.set(normalizeStr(d.nome), d.id);
  });

  const uniqueSchedules = new Map();
  schedules.forEach(h => {
    const key = `${h.professor_id}_${h.turma_id}_${h.disciplina_nome.trim()}`;
    if (!uniqueSchedules.has(key)) {
      uniqueSchedules.set(key, {
        professor_id: h.professor_id,
        turma_id: h.turma_id,
        disciplina_nome: h.disciplina_nome.trim()
      });
    }
  });

  let matched = 0;
  let unmatched = [];

  for (const [key, val] of uniqueSchedules.entries()) {
    const normSchedName = normalizeStr(val.disciplina_nome);
    
    // 1. Try exact normalized match
    let discId = discMap.get(normSchedName);

    // 2. Try prefix/substring match if exact normalized match fails
    if (!discId) {
      for (const d of disciplines) {
        const normDName = normalizeStr(d.nome);
        if (normSchedName.startsWith(normDName) || normDName.startsWith(normSchedName)) {
          discId = d.id;
          console.log(`[SMART MATCH] "${val.disciplina_nome}" mapped to discipline "${d.nome}"`);
          break;
        }
      }
    }

    if (discId) {
      matched++;
    } else {
      unmatched.push(val.disciplina_nome);
    }
  }

  console.log('\n--- SMART MATCHING RESULTS ---');
  console.log(`Successfully matched with smart heuristics: ${matched}`);
  console.log(`Unmatched: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('Unmatched names list:', Array.from(new Set(unmatched)));
  }
}

run().catch(console.error);
