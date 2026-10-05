import type { LinhaRelatorioRedacao } from '../services/redacaoService';

// Agregação do relatório de redações: por turma (média, faixas) e por critério (onde a turma errou mais),
// e a comparação entre a prévia da IA e a nota confirmada pelo professor. Tudo em porcentagem da nota
// máxima, porque as redações de uma prova podem usar modos de correção diferentes (ENEM 1000, UFMS 10...).

export const FAIXAS = ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'] as const;

export interface ResumoTurma {
  turma: string;
  n: number;
  /** Média em % da nota máxima. */
  media: number;
  min: number;
  max: number;
  /** Quantidade de redações por faixa de aproveitamento (mesma ordem de FAIXAS). */
  faixas: number[];
}

export interface ResumoCriterio {
  /** Modo de correção + critério, porque o mesmo rótulo pode ter peso diferente em outro modo. */
  modo: string;
  chave: string;
  rotulo: string;
  max: number;
  n: number;
  /** Média em % do máximo do critério. */
  media: number;
  /** % dos alunos com menos da metade dos pontos do critério. */
  abaixoMetade: number;
}

export interface ComparacaoIa {
  /** Redações em que a IA gerou prévia e o professor confirmou. */
  n: number;
  /** % de critérios em que o professor marcou "concordo" com a IA. */
  concordancia: number | null;
  /** Diferença média (professor − IA) em pontos percentuais do total; negativo = a IA foi mais generosa. */
  vies: number | null;
  /** Erro absoluto médio em pontos percentuais do total. */
  erroAbsoluto: number | null;
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function aproveitamento(l: LinhaRelatorioRedacao): number {
  return pct(l.nota_total, l.nota_maxima ?? 1000);
}

export function resumoPorTurma(linhas: LinhaRelatorioRedacao[]): ResumoTurma[] {
  const por = new Map<string, number[]>();
  for (const l of linhas) {
    const k = l.turma_nome ?? 'Sem turma';
    por.set(k, [...(por.get(k) ?? []), aproveitamento(l)]);
  }
  return [...por.entries()].map(([turma, xs]) => {
    const faixas = [0, 0, 0, 0, 0];
    for (const x of xs) faixas[Math.min(4, Math.floor(x / 20))]++;
    return { turma, n: xs.length, media: media(xs), min: Math.min(...xs), max: Math.max(...xs), faixas };
  }).sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR', { numeric: true }));
}

export function resumoPorCriterio(linhas: LinhaRelatorioRedacao[]): ResumoCriterio[] {
  const por = new Map<string, ResumoCriterio & { soma: number; abaixo: number }>();
  for (const l of linhas) {
    for (const c of l.criterios ?? []) {
      const nota = l.notas_prof?.[c.chave]?.nota;
      if (nota == null || !c.max) continue;
      const modo = l.rubrica_nome ?? 'Modo não identificado';
      const k = `${modo}|${c.chave}`;
      const r = por.get(k) ?? { modo, chave: c.chave, rotulo: c.rotulo, max: c.max, n: 0, media: 0, abaixoMetade: 0, soma: 0, abaixo: 0 };
      r.n++; r.soma += pct(nota, c.max); if (nota < c.max / 2) r.abaixo++;
      por.set(k, r);
    }
  }
  return [...por.values()].map(({ soma, abaixo, ...r }) => ({ ...r, media: soma / r.n, abaixoMetade: pct(abaixo, r.n) }))
    .sort((a, b) => a.modo.localeCompare(b.modo, 'pt-BR') || a.media - b.media);
}

export function compararComIa(linhas: LinhaRelatorioRedacao[]): ComparacaoIa {
  const comIa = linhas.filter((l) => l.ia_nota_total != null);
  let concordo = 0, marcados = 0;
  const difs: number[] = [];
  for (const l of comIa) {
    for (const c of l.criterios ?? []) {
      const v = l.notas_prof?.[c.chave];
      if (v && typeof v.concorda === 'boolean') { marcados++; if (v.concorda) concordo++; }
    }
    difs.push(aproveitamento(l) - pct(l.ia_nota_total as number, l.nota_maxima ?? 1000));
  }
  return {
    n: comIa.length,
    concordancia: marcados ? pct(concordo, marcados) : null,
    vies: difs.length ? media(difs) : null,
    erroAbsoluto: difs.length ? media(difs.map(Math.abs)) : null,
  };
}

const aspas = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** CSV (separador ;, abre direto no Excel pt-BR) com uma linha por redação e uma coluna por critério. */
export function relatorioParaCsv(linhas: LinhaRelatorioRedacao[]): string {
  const chaves = [...new Set(linhas.flatMap((l) => (l.criterios ?? []).map((c) => c.chave)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const cab = ['Turma', 'Aluno', 'Tema', 'Modo de correção', 'Nota', 'Máximo', 'Aproveitamento %', 'Prévia da IA', ...chaves];
  const corpo = linhas.map((l) => [
    l.turma_nome, l.aluno_nome, l.tema, l.rubrica_nome, l.nota_total, l.nota_maxima, aproveitamento(l).toFixed(1).replace('.', ','), l.ia_nota_total,
    ...chaves.map((k) => l.notas_prof?.[k]?.nota ?? ''),
  ].map(aspas).join(';'));
  return String.fromCharCode(0xfeff) + [cab.map(aspas).join(';'), ...corpo].join('\r\n');
}
