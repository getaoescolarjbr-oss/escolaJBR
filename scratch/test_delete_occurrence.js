import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Read .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/\r$/, '');
    env[key] = val;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

console.log('URL:', supabaseUrl);
console.log('Anon key prefix:', supabaseAnonKey.substring(0, 15));

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: list, error: fetchErr } = await supabase
    .from('ocorrências')
    .select('id, aluno_id, id_do_professor, descricao')
    .limit(1);

  if (fetchErr) {
    console.error('Error fetching occurrences:', fetchErr);
    return;
  }

  if (!list || list.length === 0) {
    console.log('No occurrences found to test deletion.');
    return;
  }

  const targetId = list[0].id;
  console.log('Attempting to delete occurrence with ID:', targetId);

  const response = await supabase
    .from('ocorrências')
    .delete()
    .eq('id', targetId);

  console.log('Delete response status:', response.status);
  console.log('Delete response error:', response.error);
  console.log('Delete response data:', response.data);
}

run();
