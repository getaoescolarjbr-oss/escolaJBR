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

const horariosExtraidos = {
  "Mônica": [
    { dia: 3, tempo: 7, disciplina: "Apoio e Orientação de Estudos", turma: "8º Ano A" },
    { dia: 5, tempo: 6, disciplina: "Literatura, Arte e Movimento", turma: "8º Ano A" },
    { dia: 5, tempo: 8, disciplina: "Literatura, Arte e Movimento", turma: "8º Ano A" }
  ]
};

async function run() {
  console.log('--- 1. Atualizando Professor ---');
  
  // Buscar Moacyr
  const { data: profMoacyr } = await supabase.from('professores').select('id, nome').ilike('nome', '%Moacyr%').single();
  
  if (profMoacyr) {
      console.log(`Encontrado: ${profMoacyr.nome}. Atualizando para Erick Vinícius Paulino Moraes...`);
      const { error: updateError } = await supabase.from('professores').update({ nome: 'Erick Vinícius Paulino Moraes' }).eq('id', profMoacyr.id);
      if (updateError) {
          console.error('Erro ao atualizar professor:', updateError.message);
      } else {
          console.log('Professor atualizado com sucesso!');
      }
  } else {
      console.log('Professor Moacyr não encontrado (talvez já tenha sido atualizado ou excluído).');
  }

  console.log('\n--- 2. Inserindo Horário da Professora Mônica ---');
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
  }

  if (inserts.length === 0) {
      console.log('Nenhum horário válido para inserir.');
      return;
  }

  const { data, error } = await supabase.from('horarios').insert(inserts);

  if (error) {
      console.error('Erro ao inserir horários da Mônica:', error.message);
  } else {
      console.log('Horários da Mônica inseridos com sucesso!');
  }
}

run().catch(console.error);
