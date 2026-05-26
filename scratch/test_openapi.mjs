const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

async function run() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}`);
  const spec = await res.json();
  
  if (spec.definitions && spec.definitions.saidas_sala) {
    console.log('\n=== COLUNAS saidas_sala ===');
    console.log(Object.keys(spec.definitions.saidas_sala.properties));
  } else {
    console.log('Tabela saidas_sala não encontrada no swagger.');
  }

  if (spec.definitions && spec.definitions.chamadas) {
    console.log('\n=== COLUNAS chamadas ===');
    console.log(Object.keys(spec.definitions.chamadas.properties));
  }
}

run().catch(console.error);
