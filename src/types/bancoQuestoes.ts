export type Alternative = { letter: string; text: string; image_url?: string | null };

// OBJETIVA = múltipla escolha (alternatives + correct_letter). DISSERTATIVA e REDACAO
// são respondidas por escrito: `alternatives` fica `[]` e `correct_letter` fica null
// (há CHECK no banco garantindo isso), a correção é manual pelo professor e a
// impressão sai com linhas pautadas em vez de alternativas.
export type TipoQuestao = 'OBJETIVA' | 'DISSERTATIVA' | 'REDACAO';

export const TIPOS_QUESTAO: TipoQuestao[] = ['OBJETIVA', 'DISSERTATIVA', 'REDACAO'];

export const TIPO_QUESTAO_LABEL: Record<TipoQuestao, string> = {
  OBJETIVA: 'Objetiva',
  DISSERTATIVA: 'Dissertativa',
  REDACAO: 'Redação',
};

// Quantas linhas pautadas imprimir quando questions.linhas_resposta é NULL.
export const LINHAS_RESPOSTA_PADRAO: Record<TipoQuestao, number> = {
  OBJETIVA: 0,
  DISSERTATIVA: 8,
  REDACAO: 30,
};

// Questões gravadas antes da coluna `tipo` existir (e RPCs que ainda não a devolvem)
// chegam com tipo undefined — tudo que não for dissertativa/redação é objetiva.
export function normalizarTipoQuestao(tipo: TipoQuestao | null | undefined): TipoQuestao {
  return tipo === 'DISSERTATIVA' || tipo === 'REDACAO' ? tipo : 'OBJETIVA';
}

export function ehQuestaoEscrita(tipo: TipoQuestao | null | undefined): boolean {
  return normalizarTipoQuestao(tipo) !== 'OBJETIVA';
}

export function linhasParaResposta(tipo: TipoQuestao | null | undefined, linhas: number | null | undefined): number {
  if (typeof linhas === 'number' && linhas > 0) return Math.min(linhas, 60);
  return LINHAS_RESPOSTA_PADRAO[normalizarTipoQuestao(tipo)];
}

export interface SupportText {
  id: string;
  discipline: string;
  content: string;
  image_url: string | null;
}

export interface Question {
  id: string;
  discipline: string;
  area: string | null;
  level: string | null;
  banca: string | null;
  orgao: string | null;
  cargo: string | null;
  ano: number | null;
  difficulty: string | null;
  assunto: string | null;
  topico: string | null;
  statement: string;
  image_url: string | null;
  tipo: TipoQuestao;
  /** Sempre array — `[]` para dissertativa/redação, nunca null. */
  alternatives: Alternative[];
  /** null para dissertativa/redação. */
  correct_letter: string | null;
  /** Resposta esperada / competências avaliadas (dissertativa e redação). */
  criterios_correcao: string | null;
  /** Linhas pautadas a imprimir; null usa LINHAS_RESPOSTA_PADRAO. */
  linhas_resposta: number | null;
  explanation: string | null;
  support_text_id: string | null;
  support_texts: SupportText | null;
  active: boolean;
  criado_por: string | null;
}

export const QUESTION_SELECT_FIELDS =
  'id, discipline, area, level, banca, orgao, cargo, ano, difficulty, assunto, topico, statement, image_url, tipo, alternatives, correct_letter, criterios_correcao, linhas_resposta, explanation, support_text_id, active, criado_por, support_texts:support_text_id(id, discipline, content, image_url)';

export interface FiltroQuestoes {
  discipline?: string;
  level?: string;
  area?: string;
  banca?: string;
  ano?: number;
  difficulty?: string;
  assunto?: string;
  topico?: string;
  tipo?: TipoQuestao;
  busca?: string;
  apenasMinhas?: string;
  page?: number;
  pageSize?: number;
}

export interface FilterOptions {
  disciplines: string[];
  difficulties: string[];
  orgaos: string[];
  cargos: string[];
  anos: number[];
  assuntos: string[];
  bancas: string[];
  levels: string[];
  areas: string[];
  topicos: string[];
}

export type TaxonomyField = 'discipline' | 'difficulty' | 'assunto' | 'topico' | 'banca' | 'orgao' | 'cargo' | 'level' | 'area';

export interface TaxonomyTerm {
  id: string;
  field: TaxonomyField;
  value: string;
}

export const TAXONOMY_FIELD_LABELS: Record<TaxonomyField, string> = {
  discipline: 'Disciplina',
  difficulty: 'Dificuldade',
  assunto: 'Assunto',
  topico: 'Tópico',
  banca: 'Banca',
  orgao: 'Órgão',
  cargo: 'Cargo',
  level: 'Nível',
  area: 'Área',
};
