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
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const studentId = 'fa7b2888-c15d-4e12-ad76-d1c85e92462d';
const classId = 'bd1df917-640f-431e-81eb-4d8e88bdc6f5';
const professorId = 'd88eea02-78fd-4f3d-abd4-9203fc2c4b30';

async function run() {
  console.log('Inserting test occurrence with valid IDs...');
  
  const { data, error } = await supabase
    .from('ocorrências')
    .insert({
      aluno_id: studentId,
      id_do_professor: professorId,
      turma_id: classId,
      descricao: 'TEST_INSERT_TEMPORARY',
      data_registro: new Date().toISOString(),
      registrado_por: 'Test Script',
      registrado_por_cargo: 'Tester'
    })
    .select();

  if (error) {
    console.error('Error inserting:', error);
  } else {
    console.log('Successfully inserted! Row structure:');
    console.log(JSON.stringify(data[0], null, 2));
    
    // Now delete it
    console.log('Deleting test occurrence...');
    const { error: delError } = await supabase
      .from('ocorrências')
      .delete()
      .eq('descricao', 'TEST_INSERT_TEMPORARY');
      
    if (delError) {
      console.error('Error deleting:', delError);
    } else {
      console.log('Cleaned up successfully.');
    }
  }
}

run();
