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

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function testManualJoin() {
  const today = new Date().toISOString().split('T')[0];
  const { data: rawAtrasos, error } = await supabase.from('atrasos')
    .select('*')
    .gte('created_at', today)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching raw:', error);
    return;
  }
  
  console.log('Raw atrasos fetched:', rawAtrasos.length);
  if (rawAtrasos.length > 0) {
    const alunoIds = [...new Set(rawAtrasos.map(d => d.aluno_id))];
    const turmaIds = [...new Set(rawAtrasos.map(d => d.turma_id))];
    
    console.log('Aluno IDs:', alunoIds);
    console.log('Turma IDs:', turmaIds);
    
    const { data: students } = await supabase.from('alunos').select('id, nome, aluno_numero').in('id', alunoIds);
    const { data: classes } = await supabase.from('turmas').select('id, nome').in('id', turmaIds);
    
    console.log('Students found:', students ? students.length : 0);
    console.log('Classes found:', classes ? classes.length : 0);
    
    const studentMap = Object.fromEntries((students || []).map(s => [s.id, s]));
    const classMap = Object.fromEntries((classes || []).map(c => [c.id, c]));
    
    const mapped = rawAtrasos.map(d => ({
      ...d,
      alunos: studentMap[d.aluno_id] || null,
      turmas: classMap[d.turma_id] || null
    }));
    
    console.log('Mapped output (first):', mapped[0]);
  }
}

testManualJoin();
