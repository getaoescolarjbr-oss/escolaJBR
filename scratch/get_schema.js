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
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

async function run() {
  const url = `${supabaseUrl}/rest/v1/`;
  console.log('Fetching OpenAPI schema from:', url);
  
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  });
  
  if (!res.ok) {
    console.error('Failed to fetch schema:', res.status, res.statusText);
    return;
  }
  
  const schema = await res.json();
  
  // Find definitions for 'ocorrências'
  const occurrencesDef = schema.definitions && (schema.definitions['ocorrências'] || schema.definitions['ocorrencias']);
  if (occurrencesDef) {
    console.log('Schema for ocorrências:');
    console.log(JSON.stringify(occurrencesDef, null, 2));
  } else {
    console.log('Definition not found. Available definitions:');
    console.log(Object.keys(schema.definitions || {}));
  }
}

run();
