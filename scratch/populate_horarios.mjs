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

// Os horários extraídos das 10 primeiras imagens
// Dicionário mapeando Nome do Professor -> Array de Horários {dia_semana, tempo, disciplina_nome, turma_nome}
const horariosExtraidos = {
  "Ana Cristina Aparecida de Souza": [
    { dia: 1, tempo: 1, disciplina: "Matemática - RA", turma: "9º Ano A" },
    { dia: 1, tempo: 2, disciplina: "Matemática - Geometria", turma: "2º Ano A" },
    { dia: 1, tempo: 4, disciplina: "Matemática - Geometria", turma: "1º Ano C" },
    { dia: 1, tempo: 7, disciplina: "Matemática - Geometria", turma: "1º Ano B" },
    { dia: 1, tempo: 8, disciplina: "Matemática - Geometria", turma: "1º Ano A" },
    { dia: 3, tempo: 1, disciplina: "Matemática - Geometria", turma: "1º Ano C" },
    { dia: 4, tempo: 6, disciplina: "Matemática - RA", turma: "7º Ano A" },
    { dia: 4, tempo: 7, disciplina: "Matemática - RA", turma: "6º Ano A" },
    { dia: 4, tempo: 8, disciplina: "Matemática - RA", turma: "8º Ano A" }
  ],
  "Andre Barbosa de Souza": [
    { dia: 1, tempo: 8, disciplina: "Língua Portuguesa", turma: "6º Ano A" },
    { dia: 2, tempo: 1, disciplina: "Língua Portuguesa", turma: "9º Ano A" },
    { dia: 2, tempo: 2, disciplina: "Língua Portuguesa", turma: "9º Ano A" },
    { dia: 2, tempo: 3, disciplina: "Língua Portuguesa", turma: "7º Ano A" },
    { dia: 2, tempo: 4, disciplina: "Língua Portuguesa", turma: "1º Ano C" },
    { dia: 2, tempo: 5, disciplina: "Língua Portuguesa", turma: "7º Ano A" },
    { dia: 2, tempo: 6, disciplina: "Língua Portuguesa", turma: "2º Ano B" },
    { dia: 2, tempo: 7, disciplina: "Língua Portuguesa", turma: "1º Ano B" },
    { dia: 2, tempo: 8, disciplina: "Língua Portuguesa", turma: "1º Ano C" },
    { dia: 3, tempo: 1, disciplina: "Língua Portuguesa", turma: "2º Ano C" },
    { dia: 3, tempo: 2, disciplina: "Língua Portuguesa", turma: "2º Ano C" },
    { dia: 3, tempo: 3, disciplina: "Língua Portuguesa", turma: "9º Ano A" },
    { dia: 3, tempo: 4, disciplina: "Língua Portuguesa", turma: "6º Ano A" },
    { dia: 3, tempo: 5, disciplina: "Língua Portuguesa", turma: "8º Ano A" },
    { dia: 3, tempo: 6, disciplina: "Língua Portuguesa", turma: "8º Ano A" },
    { dia: 3, tempo: 7, disciplina: "Língua Portuguesa", turma: "7º Ano A" },
    { dia: 3, tempo: 8, disciplina: "Língua Portuguesa", turma: "7º Ano A" },
    { dia: 4, tempo: 1, disciplina: "Língua Portuguesa", turma: "2º Ano B" },
    { dia: 4, tempo: 3, disciplina: "Língua Portuguesa", turma: "1º Ano B" },
    { dia: 4, tempo: 4, disciplina: "Língua Portuguesa", turma: "8º Ano A" },
    { dia: 4, tempo: 5, disciplina: "Língua Portuguesa", turma: "1º Ano C" },
    { dia: 4, tempo: 6, disciplina: "Língua Portuguesa", turma: "9º Ano A" },
    { dia: 4, tempo: 7, disciplina: "Língua Portuguesa", turma: "1º Ano A" },
    { dia: 4, tempo: 8, disciplina: "Língua Portuguesa", turma: "1º Ano C" },
    { dia: 5, tempo: 1, disciplina: "Língua Portuguesa", turma: "8º Ano A" },
    { dia: 5, tempo: 2, disciplina: "Língua Portuguesa", turma: "6º Ano A" },
    { dia: 5, tempo: 3, disciplina: "Língua Portuguesa", turma: "6º Ano A" },
    { dia: 5, tempo: 4, disciplina: "Língua Portuguesa", turma: "1º Ano C" },
    { dia: 5, tempo: 5, disciplina: "Língua Portuguesa", turma: "2º Ano C" },
    { dia: 5, tempo: 6, disciplina: "Língua Portuguesa", turma: "2º Ano B" },
    { dia: 5, tempo: 7, disciplina: "Língua Portuguesa", turma: "1º Ano A" },
    { dia: 5, tempo: 8, disciplina: "Língua Portuguesa", turma: "1º Ano C" }
  ],
  "Bruno de Andrade Martins": [
    { dia: 1, tempo: 6, disciplina: "Física", turma: "2º Ano A" },
    { dia: 1, tempo: 7, disciplina: "Física", turma: "2º Ano B" },
    { dia: 1, tempo: 8, disciplina: "Física", turma: "1º Ano B" },
    { dia: 2, tempo: 1, disciplina: "Física", turma: "3º Ano A" },
    { dia: 2, tempo: 2, disciplina: "Física", turma: "1º Ano C" },
    { dia: 2, tempo: 3, disciplina: "Física", turma: "2º Ano C" },
    { dia: 2, tempo: 4, disciplina: "Física", turma: "3º Ano B" },
    { dia: 2, tempo: 5, disciplina: "Física", turma: "2º Ano B" },
    { dia: 3, tempo: 6, disciplina: "Física", turma: "1º Ano C" },
    { dia: 3, tempo: 7, disciplina: "Física", turma: "1º Ano B" },
    { dia: 3, tempo: 8, disciplina: "Física", turma: "3º Ano B" },
    { dia: 4, tempo: 1, disciplina: "Física", turma: "3º Ano A" },
    { dia: 5, tempo: 1, disciplina: "Física", turma: "1º Ano C" },
    { dia: 5, tempo: 3, disciplina: "Física", turma: "2º Ano A" },
    { dia: 5, tempo: 4, disciplina: "Física", turma: "2º Ano C" },
    { dia: 5, tempo: 5, disciplina: "Física", turma: "1º Ano C" }
  ],
  "Claysson Xavier da Silva": [
    { dia: 1, tempo: 1, disciplina: "Química", turma: "1º Ano C" },
    { dia: 1, tempo: 3, disciplina: "Química", turma: "1º Ano C" },
    { dia: 1, tempo: 4, disciplina: "Química", turma: "1º Ano A" },
    { dia: 1, tempo: 5, disciplina: "Química", turma: "3º Ano A" },
    { dia: 1, tempo: 6, disciplina: "Química", turma: "1º Ano B" },
    { dia: 1, tempo: 8, disciplina: "Química", turma: "3º Ano B" },
    { dia: 2, tempo: 1, disciplina: "Química", turma: "2º Ano A" },
    { dia: 2, tempo: 5, disciplina: "Química", turma: "2º Ano C" },
    { dia: 2, tempo: 6, disciplina: "Química", turma: "1º Ano C" },
    { dia: 2, tempo: 7, disciplina: "Química", turma: "2º Ano B" },
    { dia: 2, tempo: 8, disciplina: "Química", turma: "2º Ano B" },
    { dia: 3, tempo: 6, disciplina: "Química", turma: "2º Ano C" },
    { dia: 3, tempo: 7, disciplina: "Química", turma: "1º Ano C" },
    { dia: 3, tempo: 8, disciplina: "Química", turma: "1º Ano B" },
    { dia: 5, tempo: 5, disciplina: "Química", turma: "3º Ano B" },
    { dia: 5, tempo: 6, disciplina: "Química", turma: "3º Ano A" },
    { dia: 5, tempo: 7, disciplina: "Química", turma: "2º Ano A" },
    { dia: 5, tempo: 8, disciplina: "Química", turma: "1º Ano A" }
  ],
  "Professora Clélia": [
    { dia: 2, tempo: 1, disciplina: "Literatura, Arte e Movimento", turma: "6º Ano A" },
    { dia: 5, tempo: 1, disciplina: "Apoio e Orientação de Estudos", turma: "6º Ano A" },
    { dia: 5, tempo: 3, disciplina: "Literatura, Arte e Movimento", turma: "7º Ano A" },
    { dia: 5, tempo: 4, disciplina: "Literatura, Arte e Movimento", turma: "6º Ano A" },
    { dia: 5, tempo: 5, disciplina: "Literatura, Arte e Movimento", turma: "7º Ano A" }
  ],
  "Elice Garcia Manhães": [
    { dia: 1, tempo: 1, disciplina: "Biologia", turma: "1º Ano B" },
    { dia: 1, tempo: 2, disciplina: "Ciências", turma: "7º Ano A" },
    { dia: 1, tempo: 3, disciplina: "Biologia", turma: "3º Ano A" },
    { dia: 1, tempo: 4, disciplina: "Ciências", turma: "7º Ano A" },
    { dia: 1, tempo: 5, disciplina: "Ciências", turma: "6º Ano A" },
    { dia: 1, tempo: 6, disciplina: "Ciências", turma: "8º Ano A" },
    { dia: 1, tempo: 7, disciplina: "Biologia", turma: "1º Ano A" },
    { dia: 1, tempo: 8, disciplina: "Ciências", turma: "9º Ano A" },
    { dia: 2, tempo: 2, disciplina: "Biologia", turma: "2º Ano A" },
    { dia: 2, tempo: 4, disciplina: "Unidade Curricular I", turma: "3º Ano A" },
    { dia: 2, tempo: 5, disciplina: "Ciências", turma: "6º Ano A" },
    { dia: 2, tempo: 6, disciplina: "Biologia", turma: "1º Ano B" },
    { dia: 2, tempo: 7, disciplina: "Ciências", turma: "9º Ano A" },
    { dia: 2, tempo: 8, disciplina: "Biologia", turma: "1º Ano C" },
    { dia: 3, tempo: 1, disciplina: "Ciências", turma: "6º Ano A" },
    { dia: 3, tempo: 2, disciplina: "Biologia", turma: "1º Ano C" },
    { dia: 3, tempo: 3, disciplina: "Ciências", turma: "8º Ano A" },
    { dia: 3, tempo: 4, disciplina: "Biologia", turma: "1º Ano C" },
    { dia: 3, tempo: 5, disciplina: "Unidade Curricular I", turma: "2º Ano A" },
    { dia: 3, tempo: 6, disciplina: "Ciências", turma: "7º Ano A" },
    { dia: 3, tempo: 7, disciplina: "Biologia", turma: "1º Ano C" },
    { dia: 3, tempo: 8, disciplina: "Biologia", turma: "1º Ano A" },
    { dia: 5, tempo: 1, disciplina: "Biologia", turma: "3º Ano A" },
    { dia: 5, tempo: 2, disciplina: "Ciências", turma: "8º Ano A" },
    { dia: 5, tempo: 3, disciplina: "Ciências", turma: "9º Ano A" },
    { dia: 5, tempo: 4, disciplina: "Biologia", turma: "2º Ano A" }
  ],
  "Fabio Sobral Nogueira": [
    { dia: 4, tempo: 6, disciplina: "Unidade Curricular II", turma: "2º Ano A" },
    { dia: 4, tempo: 7, disciplina: "Unidade Curricular II", turma: "3º Ano A" }
  ],
  "Fabio Junior Vilhalba do Nascimento": [
    { dia: 1, tempo: 2, disciplina: "Língua Espanhola", turma: "1º Ano C" },
    { dia: 1, tempo: 6, disciplina: "Língua Espanhola", turma: "2º Ano C" },
    { dia: 1, tempo: 7, disciplina: "Língua Espanhola", turma: "8º Ano A" },
    { dia: 2, tempo: 2, disciplina: "Língua Espanhola", turma: "3º Ano B" },
    { dia: 2, tempo: 3, disciplina: "Língua Espanhola", turma: "3º Ano A" },
    { dia: 2, tempo: 5, disciplina: "Língua Espanhola", turma: "3º Ano B" },
    { dia: 2, tempo: 6, disciplina: "Língua Espanhola", turma: "2º Ano A" },
    { dia: 2, tempo: 7, disciplina: "Língua Espanhola", turma: "1º Ano A" },
    { dia: 2, tempo: 8, disciplina: "Estudo Orientado", turma: "1º Ano B" },
    { dia: 3, tempo: 1, disciplina: "Língua Espanhola", turma: "8º Ano A" },
    { dia: 3, tempo: 2, disciplina: "Língua Espanhola", turma: "1º Ano C" },
    { dia: 3, tempo: 4, disciplina: "Língua Espanhola", turma: "1º Ano B" },
    { dia: 3, tempo: 5, disciplina: "Língua Espanhola", turma: "9º Ano A" },
    { dia: 3, tempo: 6, disciplina: "Língua Espanhola", turma: "2º Ano B" },
    { dia: 3, tempo: 7, disciplina: "Língua Espanhola", turma: "2º Ano B" },
    { dia: 3, tempo: 8, disciplina: "Língua Espanhola", turma: "1º Ano C" },
    { dia: 4, tempo: 1, disciplina: "Língua Espanhola", turma: "2º Ano A" },
    { dia: 4, tempo: 2, disciplina: "Língua Espanhola", turma: "3º Ano A" },
    { dia: 4, tempo: 3, disciplina: "Língua Espanhola", turma: "1º Ano C" },
    { dia: 4, tempo: 4, disciplina: "Língua Espanhola", turma: "9º Ano A" },
    { dia: 4, tempo: 5, disciplina: "Língua Espanhola", turma: "2º Ano C" }
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
