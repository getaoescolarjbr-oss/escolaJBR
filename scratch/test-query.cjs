const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('1. Buscando ocorrências gerais...');
  const { data: ocorrenciasData, error: e1 } = await supabase
    .from('ocorrências')
    .select('*')
    .limit(10);
  
  if (e1) {
    console.error('Erro ao buscar ocorrências:', e1);
    return;
  }
  
  console.log(`Encontradas ${ocorrenciasData.length} ocorrências.`);
  
  if (ocorrenciasData.length > 0) {
    console.log('Primeira ocorrência encontrada:', ocorrenciasData[0]);
    
    const profIds = [...new Set(ocorrenciasData.map(o => o.id_do_professor).filter(Boolean))];
    console.log('IDs de professores únicos encontrados nas ocorrências:', profIds);
    
    if (profIds.length > 0) {
      console.log('2. Buscando professores correspondentes...');
      const { data: profsData, error: e2 } = await supabase
        .from('professores')
        .select('id, nome, cargo')
        .in('id', profIds);
        
      if (e2) {
        console.error('Erro ao buscar professores:', e2);
      } else {
        console.log(`Encontrados ${profsData.length} professores.`);
        const profsMap = new Map(profsData.map(p => [p.id, p]));
        
        const mescladas = ocorrenciasData.map(o => {
          if (o.id_do_professor && profsMap.has(o.id_do_professor)) {
            return {
              ...o,
              professores: profsMap.get(o.id_do_professor)
            };
          }
          return o;
        });
        
        console.log('Exemplo de ocorrência mesclada:', mescladas[0]);
      }
    }
  }
}

test();
