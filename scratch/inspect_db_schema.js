import fs from 'fs';
import path from 'path';

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

async function run() {
  console.log('Fetching OpenAPI error message...');
  const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`);
  const schema = await res.json();
  console.log('Error schema:', schema);
}

run();
