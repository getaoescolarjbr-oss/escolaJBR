const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(
  'https://hqonnxnwozfwkpqgabpf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU'
);

// Mapeamento de nomes de disciplinas do Excel para o banco
// (para cobrir pequenas diferenças de escrita)
const DISC_MAP = {
  'Literatura Arte e Movimento': 'Literatura, Arte e Movimento',
  'Língua Inglesa': 'Lingua Inglesa',
};

function normalizeDiscNome(nome) {
  return DISC_MAP[nome] || nome;
}

function parseNota(valor) {
  if (valor === null || valor === undefined || valor === '-' || valor === 'SN' || valor === '') return null;
  const n = parseFloat(String(valor));
  return isNaN(n) ? null : n;
}

async function main() {
  console.log('=== IMPORTAÇÃO DE NOTAS 1º BIMESTRE ===\n');

  // 1. Carregar dados do Excel
  const wb = xlsx.readFile('scratch/notas_1bimestre.xlsx.xlsx');
  console.log('Planilhas encontradas:', wb.SheetNames.join(', '));

  // 2. Buscar dados do banco
  const { data: turmas } = await supabase.from('turmas').select('*');
  const { data: disciplinas } = await supabase.from('disciplinas').select('*');
  const { data: alunos } = await supabase.from('alunos').select('*');
  const { data: avaliacoesExistentes } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('bimestre_id', 1)
    .eq('nome', 'Nota 1º Bimestre');

  // Criar mapas para lookup rápido
  const turmaMap = {}; // nome -> id
  turmas.forEach(t => { turmaMap[t.nome] = t.id; });

  const discMap = {}; // nome -> id
  disciplinas.forEach(d => { discMap[d.nome] = d.id; });

  const alunoMap = {}; // "turma_id|nome" -> aluno
  alunos.forEach(a => { alunoMap[`${a.turma_id}|${a.nome}`] = a; });

  // Mapa de avaliações existentes: "turma_id|disciplina_id" -> avaliacao_id
  const avalMap = {};
  (avaliacoesExistentes || []).forEach(av => {
    avalMap[`${av.turma_id}|${av.disciplina_id}`] = av.id;
  });

  console.log(`\nTurmas no banco: ${turmas.length}`);
  console.log(`Disciplinas no banco: ${disciplinas.length}`);
  console.log(`Alunos no banco: ${alunos.length}`);
  console.log(`Avaliações 1ºBim já existentes: ${(avaliacoesExistentes || []).length}\n`);

  let totalNotas = 0;
  let totalErros = 0;
  let avaliacoesCriadas = 0;
  let notasInseridas = 0;
  let notasIgnoradas = 0;

  // 3. Processar cada planilha
  for (const sheetName of wb.SheetNames) {
    const turmaId = turmaMap[sheetName];
    if (!turmaId) {
      console.log(`⚠️  Turma não encontrada no banco: "${sheetName}" - pulando`);
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    const headers = rows[0]; // ["Turma", "Nome do Estudante", "Disciplina1", ...]
    const dataRows = rows.slice(1);

    // Colunas de disciplinas (índice 2 até antes de Faltas/Situação)
    const discColunas = [];
    for (let i = 2; i < headers.length; i++) {
      const h = headers[i];
      if (h === 'Faltas' || h === 'Situação' || h === 'Situacao') break;
      discColunas.push({ index: i, nome: h });
    }

    console.log(`\n📚 ${sheetName} (${dataRows.length} alunos, ${discColunas.length} disciplinas)`);

    // Para cada disciplina, garantir que existe uma avaliação
    const avaliacoesDaTurma = {};
    for (const dc of discColunas) {
      const discNomeNorm = normalizeDiscNome(dc.nome);
      const discId = discMap[discNomeNorm];
      if (!discId) {
        // Tentar match case-insensitive
        const discFound = disciplinas.find(d => d.nome.toLowerCase() === discNomeNorm.toLowerCase());
        if (!discFound) {
          console.log(`   ⚠️  Disciplina não encontrada: "${dc.nome}" → "${discNomeNorm}"`);
          continue;
        }
        discMap[discNomeNorm] = discFound.id;
      }

      const discIdFinal = discMap[discNomeNorm] || (disciplinas.find(d => d.nome.toLowerCase() === discNomeNorm.toLowerCase()) || {}).id;
      if (!discIdFinal) continue;

      const chave = `${turmaId}|${discIdFinal}`;
      if (avalMap[chave]) {
        avaliacoesDaTurma[dc.nome] = avalMap[chave];
      } else {
        // Criar nova avaliação
        const { data: novaAv, error: avErr } = await supabase
          .from('avaliacoes')
          .insert({
            turma_id: turmaId,
            disciplina_id: discIdFinal,
            bimestre_id: 1,
            nome: 'Nota 1º Bimestre',
            valor_maximo: 10,
            publicada: true,
          })
          .select()
          .single();

        if (avErr) {
          console.log(`   ❌ Erro ao criar avaliação para ${dc.nome}: ${avErr.message}`);
          continue;
        }
        avalMap[chave] = novaAv.id;
        avaliacoesDaTurma[dc.nome] = novaAv.id;
        avaliacoesCriadas++;
        console.log(`   ✅ Avaliação criada: ${dc.nome}`);
      }
    }

    // Para cada aluno, inserir as notas
    const notasParaInserir = [];
    for (const row of dataRows) {
      const nomeAluno = row[1];
      if (!nomeAluno) continue;

      const aluno = alunoMap[`${turmaId}|${nomeAluno}`];
      if (!aluno) {
        // Tentar match case-insensitive
        const alunoFound = alunos.find(a => 
          a.turma_id === turmaId && 
          a.nome.toLowerCase().trim() === String(nomeAluno).toLowerCase().trim()
        );
        if (!alunoFound) {
          console.log(`   ⚠️  Aluno não encontrado: "${nomeAluno}"`);
          totalErros++;
          continue;
        }
        alunoMap[`${turmaId}|${nomeAluno}`] = alunoFound;
      }
      
      const alunoId = (alunoMap[`${turmaId}|${nomeAluno}`] || {}).id;
      if (!alunoId) continue;

      for (const dc of discColunas) {
        const avalId = avaliacoesDaTurma[dc.nome];
        if (!avalId) continue;

        const nota = parseNota(row[dc.index]);
        if (nota === null) {
          notasIgnoradas++;
          continue;
        }

        notasParaInserir.push({
          avaliacao_id: avalId,
          aluno_id: alunoId,
          nota: nota,
        });
        totalNotas++;
      }
    }

    // Inserir notas em lote (upsert para evitar duplicatas)
    if (notasParaInserir.length > 0) {
      const { error: insertErr } = await supabase
        .from('notas_avaliacoes')
        .upsert(notasParaInserir, { onConflict: 'avaliacao_id,aluno_id', ignoreDuplicates: false });

      if (insertErr) {
        console.log(`   ❌ Erro ao inserir notas: ${insertErr.message}`);
        totalErros++;
      } else {
        notasInseridas += notasParaInserir.length;
        console.log(`   ✅ ${notasParaInserir.length} notas inseridas`);
      }
    }
  }

  console.log('\n=== RESUMO FINAL ===');
  console.log(`✅ Avaliações criadas: ${avaliacoesCriadas}`);
  console.log(`✅ Notas inseridas/atualizadas: ${notasInseridas}`);
  console.log(`ℹ️  Notas ignoradas (SN/-/vazio): ${notasIgnoradas}`);
  console.log(`❌ Erros: ${totalErros}`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
