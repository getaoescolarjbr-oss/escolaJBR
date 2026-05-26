import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');

let url = '';
let key = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

const userList = [
"Ana Cristina Aparecida de Souza",
"Andre Barbosa de Souza",
"Bruno de Andrade Martins",
"Claysson Xavier da Silva",
"Clélia Ávalo Olmedo",
"Elice Garcia Manhães",
"Fabio Sobral Nogueira",
"Fabio Junior Vilhalba do Nascimento",
"Fernando de Campos Barbosa Filho",
"Georlania Souza Barbosa",
"Giovane Lima Vilhanueva",
"Gislene Lopes da Silva",
"Isabela Barizon Bacarin",
"Jacqueline dos Santos",
"Janaina de Paula Barreto",
"Jefferson Pereira Berreto",
"João Maria de Faria",
"Jonathan Araujo Fernandes",
"Juliana Souza Barbosa",
"Juliana de Souza Peçanha",
"Larissa Porto Velasquez",
"Luciana Lopes da Costa",
"Marcela Cardoso de Almeida Lombardi",
"Mateus Fernandes Adriano",
"Michelle Batista Gonçalves",
"Moacyr Lopes Fernandes Júnior",
"Mônica",
"Odair Marques Pereira",
"Rafaela Bueno Miranda",
"Roger Lucas Argenta",
"Solange Duarte Araujo",
"Stella Carolina Carvalho",
"Tauane Janaina da Silva",
"Thiago Froes Acosta",
"Vanessa de Oliveira Bento de Assis",
"Vinicius Martins Bento",
"Zilda Alves de Moura",
"Ygor Argulho Caramalac",
"Willian Augusto Gonçalves Vormittag",
"Andrey Monteiro Borges"
];

async function run() {
  const { data: profs } = await supabase.from('professores').select('id, nome');
  const { data: horarios } = await supabase.from('horarios').select('professor_id');

  const profIdsWithHorarios = new Set(horarios.map(h => h.professor_id));
  
  const faltantes = [];

  for (const name of userList) {
     let searchName = name.replace('Professora ', '').replace('Professor ', '').trim();
     
     // Find prof in DB
     const p = profs.find(p => p.nome.toLowerCase() === searchName.toLowerCase() || p.nome.toLowerCase().includes(searchName.toLowerCase()) || searchName.toLowerCase().includes(p.nome.toLowerCase()));
     
     if (!p) {
        faltantes.push(`${name} (Não cadastrado no banco de dados)`);
     } else {
        if (!profIdsWithHorarios.has(p.id)) {
            faltantes.push(`${name}`);
        }
     }
  }

  console.log("Professores FALTANDO horários:");
  faltantes.forEach(f => console.log("- " + f));
  if(faltantes.length === 0) console.log("Nenhum! Todos desta lista possuem horários inseridos.");
}

run().catch(console.error);
