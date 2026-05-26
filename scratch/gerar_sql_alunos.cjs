const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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
  return String(nome).replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}
function mapSituacao(situacao) {
  if (!situacao) return 'Ativo';
  const s = String(situacao).toLowerCase().trim();
  if (s.includes('transfer')) return 'Transferido';
  if (s.includes('remanej')) return 'Remanejado';
  if (s.includes('cancel')) return 'Cancelada';
  return 'Ativo';
}
function esc(s) { return String(s).replace(/'/g, "''"); }

async function main() {
  const wb = xlsx.readFile('scratch/notas_1bimestre.xlsx.xlsx');
  const { data: turmas } = await supabase.from('turmas').select('*');
  const { data: disciplinas } = await supabase.from('disciplinas').select('*');
  const { data: alunosBanco } = await supabase.from('alunos').select('*');
  const { data: avaliacoes } = await supabase
    .from('avaliacoes').select('*').eq('bimestre_id', 1).eq('nome', 'Nota 1º Bimestre');

  const turmaMap = {};
  turmas.forEach(t => { turmaMap[t.nome] = t.id; });
  const discMap = {};
  disciplinas.forEach(d => { discMap[d.nome] = d.id; });
  const avalMap = {};
  (avaliacoes || []).forEach(av => { avalMap[`${av.turma_id}|${av.disciplina_id}`] = av.id; });

  const alunosLines = [
    '-- ============================================================',
    '-- SQL PARA INSERIR ALUNOS NOVOS (bypass RLS via SQL Editor)',
    '-- Execute no painel SQL do Supabase:',
    '-- https://supabase.com/dashboard/project/hqonnxnwozfwkpqgabpf/sql/new',
    '-- ============================================================',
    '',
    '-- ETAPA 1: Inserir alunos novos',
    '',
  ];
  const notasLines = [
    '',
    '-- ============================================================',
    '-- ETAPA 2: Inserir notas dos alunos novos',
    '-- ============================================================',
    '',
  ];

  let totalAlunos = 0;
  let totalNotas = 0;

  for (const sheetName of wb.SheetNames) {
    const turmaId = turmaMap[sheetName];
    if (!turmaId) continue;

    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    const headers = rows[0];
    const dataRows = rows.slice(1).filter(r => r[1]);

    const alunosDaTurma = alunosBanco.filter(a => a.turma_id === turmaId);
    const alunoNomeMap = {};
    alunosDaTurma.forEach(a => { alunoNomeMap[normalizeName(a.nome)] = a; });
    let maxNumero = alunosDaTurma.reduce((max, a) => Math.max(max, a.aluno_numero || 0), 0);

    const discColunas = [];
    let situacaoIndex = -1;
    for (let i = 2; i < headers.length; i++) {
      const h = String(headers[i] || '').trim();
      if (h === 'Faltas') continue;
      if (h === 'Situação' || h === 'Situacao' || h.toLowerCase().includes('itua')) {
        situacaoIndex = i;
        break;
      }
      discColunas.push({ index: i, nome: h });
    }

    for (const row of dataRows) {
      const nomeNorm = normalizeName(row[1]);
      if (!nomeNorm) continue;
      if (alunoNomeMap[nomeNorm]) continue; // já existe no banco

      maxNumero++;
      const situacao = situacaoIndex >= 0 ? row[situacaoIndex] : null;
      const status = mapSituacao(situacao);

      alunosLines.push(`-- ${sheetName} | nº ${maxNumero}`);
      alunosLines.push(`INSERT INTO alunos (nome, turma_id, aluno_numero, status)`);
      alunosLines.push(`VALUES ('${esc(nomeNorm)}', '${turmaId}', ${maxNumero}, '${status}');`);
      alunosLines.push('');
      totalAlunos++;

      // Notas desse aluno
      for (const dc of discColunas) {
        const discNomeNorm = normalizeDiscNome(dc.nome);
        const discId = discMap[discNomeNorm] ||
          (disciplinas.find(d => d.nome.toLowerCase() === discNomeNorm.toLowerCase()) || {}).id;
        if (!discId) continue;

        const avalId = avalMap[`${turmaId}|${discId}`];
        if (!avalId) continue;

        const nota = parseNota(row[dc.index]);
        if (nota === null) continue;

        notasLines.push(`-- ${nomeNorm} | ${dc.nome}: ${nota}`);
        notasLines.push(`INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)`);
        notasLines.push(`SELECT '${avalId}', id, ${nota}`);
        notasLines.push(`FROM alunos WHERE nome = '${esc(nomeNorm)}' AND turma_id = '${turmaId}'`);
        notasLines.push(`ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;`);
        notasLines.push('');
        totalNotas++;
      }
    }
  }

  const sql = [...alunosLines, ...notasLines].join('\n');
  fs.writeFileSync('scratch/inserir_alunos_novos.sql', sql, 'utf8');
  console.log(`SQL gerado com sucesso!`);
  console.log(`Alunos a inserir: ${totalAlunos}`);
  console.log(`Notas a inserir: ${totalNotas}`);
  console.log(`Arquivo: scratch/inserir_alunos_novos.sql`);
}

main().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
