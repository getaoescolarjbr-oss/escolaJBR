// Tipos do módulo de correção óptica. O schema correspondente está em
// create_correcao_omr.sql — os nomes de campo aqui espelham os das RPCs de propósito,
// para não haver uma camada de tradução onde um erro de digitação vira `undefined`
// silencioso na hora de corrigir uma prova.

/** Como as versões B/C/D são geradas a partir da A. */
export type ModoEmbaralhar = 'NENHUM' | 'QUESTOES' | 'QUESTOES_ALTERNATIVAS';

/**
 * SEM_NOTA  - só relatório.
 * DIRETA    - soma dos valores das questões acertadas.
 * PONDERADA - o melhor desempenho vira referencial e recebe o valor total; os demais
 *             ficam proporcionais a ele.
 */
export type ModoNota = 'SEM_NOTA' | 'DIRETA' | 'PONDERADA';

/** Quem é o referencial da ponderada: o melhor da prova toda ou o melhor de cada turma. */
export type PonderadaEscopo = 'PROVA' | 'TURMA';

export const MODO_EMBARALHAR_LABEL: Record<ModoEmbaralhar, string> = {
  NENHUM: 'Não embaralhar',
  QUESTOES: 'Embaralhar as questões',
  QUESTOES_ALTERNATIVAS: 'Embaralhar questões e alternativas',
};

export const MODO_NOTA_LABEL: Record<ModoNota, string> = {
  SEM_NOTA: 'Sem nota (só relatório)',
  DIRETA: 'Nota direta (soma dos acertos)',
  PONDERADA: 'Nota ponderada (proporcional ao melhor)',
};

export interface ConfigCorrecaoProva {
  embaralhar: ModoEmbaralhar;
  qtd_versoes: number;
  cartao_separado: boolean;
  modo_nota: ModoNota;
  ponderada_escopo: PonderadaEscopo;
  lancar_no_boletim: boolean;
}

/** Uma folha a imprimir: o aluno, a versão que ele recebeu e o código do QR. */
export interface AlocacaoProva {
  aluno_id: string;
  aluno_nome: string;
  numero_chamada: number | null;
  codigo_sgde: string | null;
  turma_id: string | null;
  turma_nome: string | null;
  serie_nome: string | null;
  rotulo: string;
  codigo: string;
  /** Ordem das questões nesta versão — inclui dissertativas. */
  ordem_questoes: string[];
  /** `{ "<question_id>": ["C","A","D","B"] }` — a letra original de cada bolha. */
  mapa_alternativas: Record<string, string[]>;
  ja_corrigido: boolean;
}

export interface ResumoVersao {
  rotulo: string;
  alunos: number;
}

/** Uma linha do cartão de uma versão, com a bolha correta já traduzida para a folha. */
export interface LinhaGabarito {
  linha: number;
  numero_na_prova: number;
  question_id: string;
  bolha_correta: string | null;
  qtd_alternativas: number;
  valor: number;
}

/** O que rpc_identificar_folha devolve quando o QR é lido. Nunca traz gabarito. */
export interface FolhaIdentificada {
  prova_id: string;
  aluno_id: string;
  codigo: string;
  versao: string;
  titulo: string;
  disciplina: string | null;
  valor_total: number;
  modo_nota: ModoNota;
  status: string;
  aluno_nome: string;
  numero_chamada: number | null;
  codigo_sgde: string | null;
  turma_nome: string | null;
  serie_nome: string | null;
  linhas_cartao: number;
  ja_corrigido: boolean;
  nota: number | null;
  nota_ponderada: number | null;
}

export interface ResultadoCorrecaoOmr {
  aluno_id: string;
  prova_id: string;
  versao: string;
  acertos: number;
  erros: number;
  em_branco: number;
  anuladas: number;
  total_linhas: number;
  nota: number | null;
  valor_total: number;
  modo_nota: ModoNota;
}

export interface ProgressoCorrecao {
  aluno_id: string;
  aluno_nome: string;
  numero_chamada: number | null;
  turma_nome: string | null;
  versao: string;
  codigo: string;
  corrigido: boolean;
  acertos: number | null;
  total_objetivas: number;
  nota: number | null;
  nota_ponderada: number | null;
  status_correcao: string | null;
  lido_em: string | null;
}
