import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSync() {
  await supabase.auth.signInWithPassword({ email: 'gestaoescolarjbr@gmail.com', password: 'Gest@ojbr' });

  // 1. Fetch config
  const { data: configData, error: configErr } = await supabase
    .from('landing_avisos')
    .select('*')
    .eq('titulo', 'INSTAGRAM_FEED_CONFIG')
    .eq('cor_alerta', 'config')
    .maybeSingle();

  if (configErr) {
    console.error('Config Error:', configErr);
    return;
  }
  
  if (!configData) {
    console.log('No config data found in DB.');
    return;
  }

  console.log('Config URL:', configData.mensagem);
  const feedUrl = configData.mensagem.trim();

  // 2. Fetch from Behold
  try {
    const response = await fetch(feedUrl);
    console.log('Behold Status:', response.status, response.statusText);
    
    if (!response.ok) {
        console.error('Failed to fetch from behold');
        return;
    }
    
    const feedData = await response.json();
    const posts = Array.isArray(feedData) ? feedData : (feedData.posts || feedData.data || []);
    console.log('Fetched Posts Count:', posts.length);
    if (posts.length > 0) {
        console.log('First Post:', JSON.stringify(posts[0], null, 2).slice(0, 300));
    }
  } catch (err) {
      console.error('Fetch error:', err);
  }
}

testSync().catch(console.error);
