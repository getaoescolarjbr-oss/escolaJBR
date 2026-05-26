const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(
  'https://hqonnxnwozfwkpqgabpf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU'
);

const DISC_MAP = {
  'Literatura Arte e Movimento': 'Literatura, Arte e Movimento',
  'Língua Inglesa': 'Lingua Inglesa',
};
function normalizeDiscNome(nome) { return DISC_MAP[nome] || nome; }

function parseNota(valor) {
  if (valor === null || valor === undefined || valor === '-' || valor === 'SN' || valor === '') return null;
  const n = parseFloat(String(valor));
  return isNaN(n) ? null : n;
}

function normalizeName(nome) {
  if (!nome) return '';
  return String(nome)
    .replace(/\n/g, ' ')       // quebra de linha → espaço
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')      // múltiplos espaços → um só
    .trim()
    .toUpperCase();
}

// Mapear situação do Excel para status do banco
function mapSituacao(situacao) {
  if (!situacao) return 'Ativo';
  const s = String(situacao).toLowerCase().trim();
  if (s.includes('transfer')) return 'Transferido';
  if (s.includes('remanej')) return 'Remanejado';
  if (s.includes('cancel')) return 'Cancelada';
  return 'Ativo';
}

async function main() {
  console.log('=== CORREÇÃO: NOVOS ALUNOS + STATUS + NOTAS PENDENTES ===\n');

  const wb = xlsx.readFile('scratch/notas_1bimestre.xlsx.xlsx');

  // Buscar dados do banco
  const { data: turmas } = await supabase.from('turmas').select('*');
  const { data: disciplinas } = await supabase.from('disciplinas').select('*');
  let { data: alunosBanco } = await supabase.from('alunos').select('*');
  const { data: avaliacoesExistentes } = await supabase
    .from('avaliacoes').select('*').eq('bimestre_id', 1).eq('nome', 'Nota 1º Bimestre');

  const turmaMap = {};
  turmas.forEach(t => { turmaMap[t.nome] = t.id; });

  const discMap = {};
  disciplinas.forEach(d => { discMap[d.nome] = d.id; });

  const avalMap = {};
  (avaliacoesExistentes || []).forEach(av => {
    avalMap[`${av.turma_id}|${av.disciplina_id}`] = av.id;
  });

  let totalAlunosCriados = 0;
  let totalStatusAtualizados = 0;
  let totalNotasInseridas = 0;
  let totalErros = 0;

  for (const sheetName of wb.SheetNames) {
    const turmaId = turmaMap[sheetName];
    if (!turmaId) {
      console.log(`⚠️  Turma não encontrada: "${sheetName}" - pulando`);
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    const headers = rows[0];
    const dataRows = rows.slice(1).filter(r => r[1]); // só linhas com nome

    console.log(`\n📚 ${sheetName} (${dataRows.length} alunos no Excel)`);

    // Colunas de disciplinas
    const discColunas = [];
    let situacaoIndex = -1;
    for (let i = 2; i < headers.length; i++) {
      const h = String(headers[i] || '').trim();
      if (h === 'Faltas') continue;
      if (h === 'Situação' || h === 'Situacao' || h === 'SituaÃ§Ã£o') {
        situacaoIndex = i;
        break;
      }
      discColunas.push({ index: i, nome: h });
    }

    // Reconstruir mapa de alunos desta turma (com nome normalizado)
    const alunosDaTurma = alunosBanco.filter(a => a.turma_id === turmaId);
    const alunoNomeMap = {}; // nome normalizado → aluno
    alunosDaTurma.forEach(a => {
      alunoNomeMap[normalizeName(a.nome)] = a;
    });

    // Descobrir maior aluno_numero existente na turma
    let maxNumero = alunosDaTurma.reduce((max, a) => Math.max(max, a.aluno_numero || 0), 0);

    // Processar cada linha do Excel
    const notasParaInserir = [];

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      const nomeOriginal = row[1];
      const nomeNorm = normalizeName(nomeOriginal);
      if (!nomeNorm) continue;

      const situacaoExcel = situacaoIndex >= 0 ? row[situacaoIndex] : null;
      const statusNovo = mapSituacao(situacaoExcel);

      let aluno = alunoNomeMap[nomeNorm];

      // --- ALUNO NÃO ENCONTRADO: CRIAR ---
      if (!aluno) {
        maxNumero++;
        const novoAluno = {
          nome: nomeNorm,
          turma_id: turmaId,
          aluno_numero: maxNumero,
          status: statusNovo,
        };

        const { data: criado, error: errCriacao } = await supabase
          .from('alunos')
          .insert(novoAluno)
          .select()
          .single();

        if (errCriacao) {
          console.log(`   ❌ Erro ao criar aluno "${nomeNorm}": ${errCriacao.message}`);
          totalErros++;
          continue;
        }

        console.log(`   ➕ Aluno criado: ${nomeNorm} (nº ${maxNumero}, status: ${statusNovo})`);
        alunosBanco.push(criado);
        alunoNomeMap[nomeNorm] = criado;
        aluno = criado;
        totalAlunosCriados++;
      } else {
        // --- ALUNO JÁ EXISTE: VERIFICAR STATUS ---
        const statusAtual = aluno.status;
        // Atualizar se o status mudou (ex: Ativo → Transferido)
        if (statusNovo !== 'Ativo' && statusAtual !== statusNovo) {
          const { error: errStatus } = await supabase
            .from('alunos')
            .update({ status: statusNovo })
            .eq('id', aluno.id);

          if (errStatus) {
            console.log(`   ❌ Erro ao atualizar status de "${nomeNorm}": ${errStatus.message}`);
          } else {
            console.log(`   🔄 Status atualizado: ${nomeNorm} → ${statusNovo}`);
            aluno.status = statusNovo;
            totalStatusAtualizados++;
          }
        }
      }

      // --- COLETAR NOTAS PARA INSERIR ---
      for (const dc of discColunas) {
        const discNomeNorm = normalizeDiscNome(dc.nome);
        const discId = discMap[discNomeNorm] ||
          (disciplinas.find(d => d.nome.toLowerCase() === discNomeNorm.toLowerCase()) || {}).id;
        if (!discId) continue;

        const chave = `${turmaId}|${discId}`;
        const avalId = avalMap[chave];
        if (!avalId) continue; // avaliação não existe ainda (será raro)

        const nota = parseNota(row[dc.index]);
        if (nota === null) continue;

        notasParaInserir.push({
          avaliacao_id: avalId,
          aluno_id: aluno.id,
          nota: nota,
        });
      }
    }

    // Inserir/atualizar notas em lote
    if (notasParaInserir.length > 0) {
      const { error: insertErr } = await supabase
        .from('notas_avaliacoes')
        .upsert(notasParaInserir, { onConflict: 'avaliacao_id,aluno_id', ignoreDuplicates: false });

      if (insertErr) {
        console.log(`   ❌ Erro ao inserir notas: ${insertErr.message}`);
        totalErros++;
      } else {
        console.log(`   ✅ ${notasParaInserir.length} notas inseridas/atualizadas`);
        totalNotasInseridas += notasParaInserir.length;
      }
    } else {
      console.log(`   ℹ️  Nenhuma nota pendente`);
    }
  }

  console.log('\n=== RESUMO FINAL ===');
  console.log(`➕ Alunos criados: ${totalAlunosCriados}`);
  console.log(`🔄 Status atualizados: ${totalStatusAtualizados}`);
  console.log(`✅ Notas inseridas/atualizadas: ${totalNotasInseridas}`);
  console.log(`❌ Erros: ${totalErros}`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
