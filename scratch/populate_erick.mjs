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

// Horários do Moacyr que devem ir para o Erick
const horariosExtraidos = {
  "Erick Vinícius Paulino Moraes": [
    { dia: 2, tempo: 6, disciplina: "Arte", turma: "8º Ano A" },
    { dia: 2, tempo: 8, disciplina: "Arte", turma: "6º Ano A" },
    { dia: 4, tempo: 6, disciplina: "Arte", turma: "6º Ano A" },
    { dia: 4, tempo: 7, disciplina: "Arte", turma: "8º Ano A" },
    { dia: 4, tempo: 8, disciplina: "Arte", turma: "7º Ano A" },
    { dia: 5, tempo: 7, disciplina: "Arte", turma: "7º Ano A" }
  ]
};

async function run() {
  console.log('Buscando Erick Vinícius Paulino Moraes...');
  const { data: profs } = await supabase.from('professores').select('id, nome').ilike('nome', '%Erick%');
  const { data: turmas } = await supabase.from('turmas').select('id, nome');

  const profId = profs.length > 0 ? profs[0].id : null;

  if (!profId) {
      console.error(`Atenção: Erick não encontrado no banco.`);
      return;
  }

  const getTurmaId = (name) => {
     const t = turmas.find(t => t.nome.toLowerCase() === name.toLowerCase());
     return t ? t.id : null;
  };

  const inserts = [];

  for (const h of horariosExtraidos["Erick Vinícius Paulino Moraes"]) {
      const turmaId = getTurmaId(h.turma);
      if (!turmaId) {
          console.error(`Atenção: Turma "${h.turma}" não encontrada no banco. Pulando horário...`);
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

  if (inserts.length === 0) {
      console.log('Nenhum horário válido para inserir.');
      return;
  }

  console.log(`Inserindo ${inserts.length} horários para o Erick no banco de dados...`);
  const { data, error } = await supabase.from('horarios').insert(inserts);

  if (error) {
      console.error('Erro ao inserir horários:', error);
  } else {
      console.log('Horários inseridos com sucesso!');
  }
}

run().catch(console.error);
