import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envUrl = envFile.split('\n').find(l => l.startsWith('VITE_SUPABASE_URL='))?.split('=')[1]?.trim();
const envKey = envFile.split('\n').find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='))?.split('=')[1]?.trim();

const supabase = createClient(envUrl, envKey);

async function test() {
  const { data: turmas } = await supabase.from('turmas').select('id, nome').limit(1);
  const turmaId = turmas[0].id;
  console.log('Turma:', turmas[0].nome);

  const { data: avaliacoes, error } = await supabase
      .from('avaliacoes')
      .select('id, valor_maximo, nome, disciplinas(nome), disciplina_id')
      .eq('turma_id', turmaId)
      .eq('bimestre_id', 2);
  
  console.log('Avaliacoes fetch error:', error);
  console.log('Avaliacoes:', JSON.stringify(avaliacoes, null, 2));
}

test();
