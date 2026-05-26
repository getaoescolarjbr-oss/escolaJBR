
const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU';

const disciplinas = [
    "Apoio e Orientação de Estudos", "Arte", "Biologia", "Ciências", "Ciências Humanas e Sociedade",
    "Ciências Naturais na Contemporaneidade", "Educação Física", "Ensino Religioso", "Estudo Orientado",
    "Filosofia", "Física", "Geografia", "História", "Laboratório de Linguas", "Leitura e Produção Textual",
    "Letramento e Raciocínio Matemático", "Língua Espanhola", "Lingua Inglesa", "Língua Portuguesa",
    "Língua Portuguesa - Literatura e Produção Textual", "Língua Portuguesa - RA", "Literatura, Arte e Movimento",
    "Matemática", "Matemática - Geometria", "Matemática - RA", "Prática de Escrita e Estilo",
    "Qualificação Profissional", "Química", "Sociologia", "Tecnologia e Cidadania Digital",
    "Unidade Curricular I", "Unidade Curricular II", "Unidade Curricular III", "Unidade Curricular IV"
];

async function migrate() {
    console.log('Iniciando importação de disciplinas...');
    
    const dataToInsert = disciplinas.map(nome => ({ nome }));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/disciplinas`, {
        method: 'POST',
        headers: { 
            'apikey': SUPABASE_KEY, 
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(dataToInsert)
    });

    if (res.ok) {
        console.log(`Sucesso! ${disciplinas.length} disciplinas importadas.`);
    } else {
        const err = await res.json();
        console.error('Erro na importação:', err);
    }
}

migrate();
