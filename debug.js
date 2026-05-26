import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Fetching configs...');
  const { data: configs } = await supabase.from('config_professores').select('*').limit(10);
  console.log(JSON.stringify(configs, null, 2));

  const { data: turmas } = await supabase.from('turmas').select('*').ilike('nome', '%2º ano B%');
  console.log('Turmas:', turmas);
}

main().catch(console.error);
