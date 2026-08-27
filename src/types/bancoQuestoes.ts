export type Alternative = { letter: string; text: string; image_url?: string | null };

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
  statement: string;
  image_url: string | null;
  alternatives: Alternative[];
  correct_letter: string;
  explanation: string | null;
  support_text_id: string | null;
  support_texts: SupportText | null;
  active: boolean;
}

export const QUESTION_SELECT_FIELDS =
  'id, discipline, area, level, banca, orgao, cargo, ano, difficulty, assunto, statement, image_url, alternatives, correct_letter, explanation, support_text_id, active, support_texts:support_text_id(id, discipline, content, image_url)';

export interface FiltroQuestoes {
  discipline?: string;
  level?: string;
  area?: string;
  banca?: string;
  ano?: number;
  difficulty?: string;
  assunto?: string;
  busca?: string;
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
}

export type TaxonomyField = 'discipline' | 'difficulty' | 'assunto' | 'banca' | 'orgao' | 'cargo' | 'level' | 'area';

export interface TaxonomyTerm {
  id: string;
  field: TaxonomyField;
  value: string;
}

export const TAXONOMY_FIELD_LABELS: Record<TaxonomyField, string> = {
  discipline: 'Disciplina',
  difficulty: 'Dificuldade',
  assunto: 'Assunto',
  banca: 'Banca',
  orgao: 'Órgão',
  cargo: 'Cargo',
  level: 'Nível',
  area: 'Área',
};
