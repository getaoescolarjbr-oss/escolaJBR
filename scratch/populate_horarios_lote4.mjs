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

// Lote 4 de professores extraídos
const horariosExtraidos = {
  "Juliana Souza Barbosa": [
    { dia: 2, tempo: 7, disciplina: "Língua Portuguesa", turma: "2º Ano A" },
    { dia: 2, tempo: 8, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "3º Ano A" },
    { dia: 4, tempo: 7, disciplina: "Língua Portuguesa", turma: "2º Ano A" },
    { dia: 4, tempo: 8, disciplina: "Língua Portuguesa", turma: "3º Ano A" }
  ],
  "Juliana de Souza Peçanha": [
    { dia: 3, tempo: 6, disciplina: "Unidade Curricular IV", turma: "2º Ano A" },
    { dia: 3, tempo: 8, disciplina: "Unidade Curricular IV", turma: "3º Ano A" }
  ],
  "Larissa Porto Velasquez": [
    { dia: 1, tempo: 3, disciplina: "Estudo Orientado", turma: "1º Ano A" },
    { dia: 1, tempo: 4, disciplina: "Ciências Naturais na Contemporaneidade", turma: "9º Ano A" },
    { dia: 1, tempo: 5, disciplina: "Ciências Naturais na Contemporaneidade", turma: "7º Ano A" },
    { dia: 3, tempo: 6, disciplina: "Ciências Naturais na Contemporaneidade", turma: "6º Ano A" },
    { dia: 3, tempo: 7, disciplina: "Ciências Naturais na Contemporaneidade", turma: "9º Ano A" },
    { dia: 3, tempo: 8, disciplina: "Ciências Naturais na Contemporaneidade", turma: "8º Ano A" },
    { dia: 5, tempo: 6, disciplina: "Ciências Naturais na Contemporaneidade", turma: "7º Ano A" },
    { dia: 5, tempo: 7, disciplina: "Ciências Naturais na Contemporaneidade", turma: "8º Ano A" },
    { dia: 5, tempo: 8, disciplina: "Ciências Naturais na Contemporaneidade", turma: "6º Ano A" }
  ],
  "Luciana Lopes da Costa": [
    { dia: 1, tempo: 1, disciplina: "Geografia", turma: "6º Ano A" },
    { dia: 1, tempo: 2, disciplina: "Geografia", turma: "3º Ano B" },
    { dia: 1, tempo: 3, disciplina: "Geografia EF", turma: "7º Ano A" },
    { dia: 1, tempo: 4, disciplina: "Geografia EF", turma: "6º Ano A" },
    { dia: 1, tempo: 5, disciplina: "Geografia EF", turma: "8º Ano A" },
    { dia: 1, tempo: 6, disciplina: "Geografia EF", turma: "9º Ano A" },
    { dia: 1, tempo: 7, disciplina: "Geografia", turma: "3º Ano A" },
    { dia: 1, tempo: 8, disciplina: "Geografia EF", turma: "7º Ano A" },
    { dia: 4, tempo: 1, disciplina: "Geografia", turma: "3º Ano B" },
    { dia: 4, tempo: 2, disciplina: "Geografia EF", turma: "9º Ano A" },
    { dia: 4, tempo: 3, disciplina: "Geografia EF", turma: "8º Ano A" },
    { dia: 4, tempo: 4, disciplina: "Geografia EF", turma: "7º Ano A" },
    { dia: 4, tempo: 5, disciplina: "Geografia EF", turma: "6º Ano A" },
    { dia: 5, tempo: 1, disciplina: "Geografia EF", turma: "9º Ano A" },
    { dia: 5, tempo: 3, disciplina: "Geografia EF", turma: "8º Ano A" },
    { dia: 5, tempo: 5, disciplina: "Geografia", turma: "3º Ano A" }
  ],
  "Marcela Cardoso de Almeida Lombardi": [
    { dia: 1, tempo: 1, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "1º Ano A" },
    { dia: 2, tempo: 1, disciplina: "Unidade Curricular IV", turma: "2º Ano C" },
    { dia: 2, tempo: 4, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "2º Ano C" },
    { dia: 3, tempo: 1, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "1º Ano C" },
    { dia: 3, tempo: 2, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "1º Ano B" },
    { dia: 3, tempo: 3, disciplina: "Prática de Escrita e Estilo", turma: "1º Ano C" },
    { dia: 3, tempo: 4, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "2º Ano B" },
    { dia: 4, tempo: 1, disciplina: "Prática de Escrita e Estilo", turma: "1º Ano C" },
    { dia: 4, tempo: 2, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "2º Ano C" },
    { dia: 4, tempo: 3, disciplina: "Prática de Escrita e Estilo", turma: "1º Ano A" },
    { dia: 4, tempo: 4, disciplina: "Prática de Escrita e Estilo", turma: "1º Ano B" },
    { dia: 5, tempo: 2, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "1º Ano C" },
    { dia: 5, tempo: 3, disciplina: "Língua Portuguesa - Literatura e Produção Textual", turma: "2º Ano B" },
    { dia: 5, tempo: 4, disciplina: "Unidade Curricular IV", turma: "1º Ano C" }
  ]
};

async function run() {
  console.log('Buscando professores e turmas do banco de dados...');
  const { data: profs } = await supabase.from('professores').select('id, nome');
  const { data: turmas } = await supabase.from('turmas').select('id, nome');

  const getProfId = (name) => {
     const p = profs.find(p => p.nome.toLowerCase() === name.toLowerCase() || p.nome.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.nome.toLowerCase()));
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
