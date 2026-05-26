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

// Lote 7 de professores extraídos
const horariosExtraidos = {
  "Solange Duarte Araujo": [
    { dia: 3, tempo: 2, disciplina: "Arte", turma: "9º Ano A" },
    { dia: 3, tempo: 3, disciplina: "Arte", turma: "1º Ano A" },
    { dia: 3, tempo: 4, disciplina: "Arte", turma: "9º Ano A" }
  ],
  "Stella Carolina Carvalho": [
    { dia: 1, tempo: 1, disciplina: "História", turma: "8º Ano A" },
    { dia: 1, tempo: 2, disciplina: "História", turma: "9º Ano A" },
    { dia: 1, tempo: 3, disciplina: "História", turma: "9º Ano A" },
    { dia: 1, tempo: 4, disciplina: "História", turma: "8º Ano A" },
    { dia: 4, tempo: 1, disciplina: "História", turma: "8º Ano A" },
    { dia: 4, tempo: 3, disciplina: "História", turma: "9º Ano A" }
  ],
  "Tauane Janaina da Silva": [
    { dia: 1, tempo: 1, disciplina: "Arte", turma: "2º Ano B" },
    { dia: 1, tempo: 3, disciplina: "Arte", turma: "2º Ano A" },
    { dia: 3, tempo: 1, disciplina: "Arte", turma: "2º Ano A" },
    { dia: 3, tempo: 2, disciplina: "Arte", turma: "3º Ano A" },
    { dia: 3, tempo: 3, disciplina: "Arte", turma: "2º Ano B" },
    { dia: 3, tempo: 4, disciplina: "Arte", turma: "2º Ano C" },
    { dia: 3, tempo: 5, disciplina: "Arte", turma: "2º Ano C" },
    { dia: 5, tempo: 1, disciplina: "Arte", turma: "3º Ano B" },
    { dia: 5, tempo: 3, disciplina: "Arte", turma: "3º Ano B" },
    { dia: 5, tempo: 4, disciplina: "Arte", turma: "3º Ano A" }
  ],
  "Thiago Froes Acosta": [
    { dia: 1, tempo: 1, disciplina: "Filosofia", turma: "1º Ano C" },
    { dia: 1, tempo: 2, disciplina: "Filosofia", turma: "2º Ano C" },
    { dia: 1, tempo: 3, disciplina: "Ciências Humanas e Sociedade", turma: "6º Ano A" },
    { dia: 1, tempo: 4, disciplina: "Filosofia", turma: "3º Ano A" },
    { dia: 1, tempo: 5, disciplina: "Filosofia", turma: "3º Ano B" },
    { dia: 1, tempo: 6, disciplina: "Ciências Humanas e Sociedade", turma: "7º Ano A" },
    { dia: 1, tempo: 7, disciplina: "Filosofia", turma: "1º Ano C" },
    { dia: 1, tempo: 8, disciplina: "Ciências Humanas e Sociedade", turma: "8º Ano A" },
    { dia: 2, tempo: 6, disciplina: "Ciências Humanas e Sociedade", turma: "6º Ano A" },
    { dia: 2, tempo: 7, disciplina: "Filosofia", turma: "1º Ano C" },
    { dia: 2, tempo: 8, disciplina: "Ciências Humanas e Sociedade", turma: "8º Ano A" },
    { dia: 3, tempo: 1, disciplina: "Filosofia", turma: "1º Ano A" },
    { dia: 3, tempo: 2, disciplina: "Ciências Humanas e Sociedade", turma: "7º Ano A" },
    { dia: 3, tempo: 3, disciplina: "Filosofia", turma: "1º Ano C" },
    { dia: 3, tempo: 4, disciplina: "Filosofia", turma: "2º Ano A" },
    { dia: 3, tempo: 5, disciplina: "Filosofia", turma: "3º Ano A" },
    { dia: 3, tempo: 6, disciplina: "Filosofia", turma: "3º Ano B" },
    { dia: 3, tempo: 7, disciplina: "Filosofia", turma: "2º Ano A" },
    { dia: 3, tempo: 8, disciplina: "Filosofia", turma: "2º Ano B" },
    { dia: 5, tempo: 6, disciplina: "Filosofia", turma: "2º Ano C" },
    { dia: 5, tempo: 7, disciplina: "Filosofia", turma: "1º Ano B" },
    { dia: 5, tempo: 8, disciplina: "Filosofia", turma: "2º Ano B" }
  ],
  "Vanessa de Oliveira Bento de Assis": [
    { dia: 1, tempo: 2, disciplina: "Laboratório de Línguas-Libras", turma: "2º Ano B" },
    { dia: 1, tempo: 4, disciplina: "Laboratório de Línguas-Libras", turma: "1º Ano C" },
    { dia: 1, tempo: 5, disciplina: "Laboratório de Línguas-Libras", turma: "1º Ano A" },
    { dia: 2, tempo: 6, disciplina: "Laboratório de Línguas-Libras", turma: "2º Ano C" },
    { dia: 2, tempo: 7, disciplina: "Laboratório de Línguas-Libras", turma: "1º Ano C" },
    { dia: 2, tempo: 8, disciplina: "Laboratório de Línguas-Libras", turma: "2º Ano A" },
    { dia: 5, tempo: 6, disciplina: "Laboratório de Línguas-Libras", turma: "3º Ano B" },
    { dia: 5, tempo: 7, disciplina: "Laboratório de Línguas-Libras", turma: "3º Ano A" },
    { dia: 5, tempo: 8, disciplina: "Laboratório de Línguas-Libras", turma: "1º Ano B" }
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
