const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read and parse env
const envContent = fs.readFileSync('.env.local', 'utf8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    envConfig[match[1]] = value;
  }
});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: atrasos, error: e1 } = await supabase.from('atrasos').select('*, alunos(nome)').order('created_at', { ascending: false }).limit(5);
  console.log('--- ATRASOS ---');
  if (e1) console.error(e1);
  else console.log(JSON.stringify(atrasos, null, 2));

  const { data: saidas, error: e2 } = await supabase.from('saidas_antecipadas').select('*, alunos(nome)').order('created_at', { ascending: false }).limit(5);
  console.log('--- SAIDAS ---');
  if (e2) console.error(e2);
  else console.log(JSON.stringify(saidas, null, 2));
}

check();
