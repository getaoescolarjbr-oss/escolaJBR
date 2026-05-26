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

// Lote 6 de professores extraídos
const horariosExtraidos = {
  "Professora Mônica": [
    { dia: 3, tempo: 7, disciplina: "Apoio e Orientação de Estudos", turma: "8º Ano A" },
    { dia: 5, tempo: 6, disciplina: "Literatura, Arte e Movimento", turma: "8º Ano A" },
    { dia: 5, tempo: 8, disciplina: "Literatura, Arte e Movimento", turma: "8º Ano A" }
  ],
  "Odair Marques Pereira": [
    { dia: 1, tempo: 1, disciplina: "Sociologia", turma: "3º Ano A" },
    { dia: 1, tempo: 2, disciplina: "Sociologia", turma: "1º Ano B" },
    { dia: 1, tempo: 3, disciplina: "Sociologia", turma: "3º Ano B" },
    { dia: 1, tempo: 4, disciplina: "Sociologia", turma: "2º Ano B" },
    { dia: 1, tempo: 5, disciplina: "Sociologia", turma: "1º Ano C" },
    { dia: 3, tempo: 1, disciplina: "Sociologia", turma: "3º Ano A" },
    { dia: 3, tempo: 3, disciplina: "Sociologia", turma: "3º Ano B" },
    { dia: 4, tempo: 1, disciplina: "Sociologia", turma: "2º Ano C" },
    { dia: 4, tempo: 2, disciplina: "Sociologia", turma: "2º Ano A" },
    { dia: 4, tempo: 3, disciplina: "Sociologia", turma: "2º Ano C" },
    { dia: 4, tempo: 4, disciplina: "Sociologia", turma: "1º Ano A" },
    { dia: 4, tempo: 6, disciplina: "Sociologia", turma: "1º Ano C" },
    { dia: 4, tempo: 7, disciplina: "Sociologia", turma: "1º Ano C" },
    { dia: 4, tempo: 8, disciplina: "Sociologia", turma: "2º Ano A" },
    { dia: 5, tempo: 1, disciplina: "Sociologia", turma: "2º Ano B" },
    { dia: 5, tempo: 2, disciplina: "Sociologia", turma: "1º Ano C" }
  ],
  "Gislene Lopes da Silva": [
    { dia: 1, tempo: 1, disciplina: "Matemática - RA", turma: "2º Ano A" },
    { dia: 1, tempo: 2, disciplina: "Matemática - RA", turma: "1º Ano C" },
    { dia: 1, tempo: 3, disciplina: "Matemática - RA", turma: "1º Ano B" },
    { dia: 1, tempo: 4, disciplina: "Matemática - RA", turma: "1º Ano B" },
    { dia: 1, tempo: 5, disciplina: "Letramento e Raciocínio Matemático", turma: "9º Ano A" },
    { dia: 2, tempo: 2, disciplina: "Letramento e Raciocínio Matemático", turma: "7º Ano A" },
    { dia: 2, tempo: 3, disciplina: "Letramento e Raciocínio Matemático", turma: "8º Ano A" },
    { dia: 2, tempo: 4, disciplina: "Letramento e Raciocínio Matemático", turma: "6º Ano A" },
    { dia: 4, tempo: 1, disciplina: "Letramento e Raciocínio Matemático", turma: "6º Ano A" },
    { dia: 4, tempo: 2, disciplina: "Matemática - RA", turma: "3º Ano B" },
    { dia: 4, tempo: 3, disciplina: "Matemática - RA", turma: "2º Ano B" },
    { dia: 4, tempo: 4, disciplina: "Matemática - RA", turma: "3º Ano A" },
    { dia: 5, tempo: 2, disciplina: "Letramento e Raciocínio Matemático", turma: "7º Ano A" },
    { dia: 5, tempo: 3, disciplina: "Matemática - RA", turma: "2º Ano C" },
    { dia: 5, tempo: 4, disciplina: "Letramento e Raciocínio Matemático", turma: "8º Ano A" },
    { dia: 5, tempo: 5, disciplina: "Letramento e Raciocínio Matemático", turma: "9º Ano A" }
  ],
  "Rafaela Bueno Miranda": [
    { dia: 4, tempo: 6, disciplina: "Unidade Curricular II", turma: "1º Ano C" },
    { dia: 4, tempo: 7, disciplina: "Unidade Curricular II", turma: "2º Ano B" },
    { dia: 4, tempo: 8, disciplina: "Unidade Curricular II", turma: "3º Ano B" }
  ],
  "Roger Lucas Argenta": [
    { dia: 1, tempo: 5, disciplina: "Matemática - Geometria", turma: "2º Ano C" },
    { dia: 1, tempo: 6, disciplina: "Matemática", turma: "2º Ano B" },
    { dia: 1, tempo: 7, disciplina: "Matemática", turma: "2º Ano C" },
    { dia: 2, tempo: 4, disciplina: "Matemática", turma: "2º Ano B" },
    { dia: 2, tempo: 6, disciplina: "Matemática", turma: "3º Ano B" },
    { dia: 2, tempo: 7, disciplina: "Matemática", turma: "3º Ano A" },
    { dia: 2, tempo: 8, disciplina: "Matemática", turma: "2º Ano C" },
    { dia: 4, tempo: 2, disciplina: "Matemática", turma: "2º Ano B" },
    { dia: 4, tempo: 3, disciplina: "Matemática - Geometria", turma: "3º Ano A" },
    { dia: 4, tempo: 5, disciplina: "Matemática", turma: "3º Ano A" },
    { dia: 4, tempo: 6, disciplina: "Matemática", turma: "3º Ano B" },
    { dia: 4, tempo: 7, disciplina: "Matemática - Geometria", turma: "3º Ano B" },
    { dia: 4, tempo: 8, disciplina: "Matemática", turma: "2º Ano C" },
    { dia: 5, tempo: 5, disciplina: "Matemática - Geometria", turma: "2º Ano B" },
    { dia: 5, tempo: 7, disciplina: "Matemática", turma: "3º Ano B" },
    { dia: 5, tempo: 8, disciplina: "Matemática", turma: "3º Ano A" }
  ]
};

async function run() {
  console.log('Buscando professores e turmas do banco de dados...');
  const { data: profs } = await supabase.from('professores').select('id, nome');
  const { data: turmas } = await supabase.from('turmas').select('id, nome');

  const getProfId = (name) => {
     let searchName = name.replace('Professora ', '').replace('Professor ', '').trim();
     const p = profs.find(p => p.nome.toLowerCase() === searchName.toLowerCase() || p.nome.toLowerCase().includes(searchName.toLowerCase()) || searchName.toLowerCase().includes(p.nome.toLowerCase()));
     return p ? p.id : null;
  };

  const getTurmaId = (name) => {
     const t = turmas.find(t => t.nome.toLowerCase() === name.toLowerCase());
     return t ? t.id : null;
  };

  const inserts = [];

  for (const [profName, horariosList] of Object.entries(horariosExtraidos)) {
      const profId = getProfId(profName);
      if (!profId) {
          console.error(`Atenção: Professor "${profName}" não encontrado no banco. Pulando...`);
          continue;
      }

      for (const h of horariosList) {
          const turmaId = getTurmaId(h.turma);
          if (!turmaId) {
              console.error(`Atenção: Turma "${h.turma}" não encontrada no banco (Professor: ${profName}). Pulando horário...`);
              continue;
          }

          inserts.push({
              professor_id: profId,
              turma_id: turmaId,
              dia_semana: h.dia,
              tempo: h.tempo,
              disciplina_nome: h.disciplina
          });
      }
  }

  if (inserts.length === 0) {
      console.log('Nenhum horário válido para inserir.');
      return;
  }

  console.log(`Inserindo ${inserts.length} horários no banco de dados...`);
  const { data, error } = await supabase.from('horarios').insert(inserts);

  if (error) {
      console.error('Erro ao inserir horários:', error);
  } else {
      console.log('Todos os horários inseridos com sucesso!');
  }
}

run().catch(console.error);
