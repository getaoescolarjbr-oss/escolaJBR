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

async function testNoFilter() {
  const { data: rawAtrasos, error } = await supabase.from('atrasos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error fetching raw:', error);
    return;
  }
  
  console.log('Last 5 raw atrasos:', JSON.stringify(rawAtrasos, null, 2));
}

testNoFilter();
