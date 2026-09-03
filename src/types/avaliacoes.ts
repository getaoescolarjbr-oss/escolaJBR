import type { TipoQuestao } from './bancoQuestoes';
import type { ModoEmbaralhar, ModoNota, PonderadaEscopo } from './correcaoOmr';

export type ModoAvaliacao = 'IMPRESSA' | 'ONLINE' | 'AMBAS';
export type StatusAvaliacao = 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA';
// AVALIACAO gera nota em "Notas e Avaliações" (sincronizarNotasDaProva); SIMULADO nunca
// sincroniza nota e é aplicado por link público (token_publico) sem login — ver
// create_simulados_publico.sql.
export type TipoAvaliacao = 'AVALIACAO' | 'SIMULADO';

export interface Avaliacao {
  id: string;
  titulo: string;
  disciplina: string | null;
  disciplina_id: string | null;
  bimestre_id: number | null;
  instrucoes: string | null;
  valor_total: number;
  modo: ModoAvaliacao;
  tipo: TipoAvaliacao;
  token_publico: string;
  data_aplicacao: string | null;
  prazo_entrega: string | null;
  status: StatusAvaliacao;
  criado_por: string;
  created_at: string;
  updated_at: string;

  // Aplicação impressa com correção óptica — ver create_correcao_omr.sql.
  embaralhar: ModoEmbaralhar;
  qtd_versoes: number;
  cartao_separado: boolean;
  modo_nota: ModoNota;
  ponderada_escopo: PonderadaEscopo;
  lancar_no_boletim: boolean;

  turma_ids?: string[];
  turma_nomes?: string[];
  total_questoes?: number;
}

export interface AvaliacaoQuestaoInput {
  question_id: string;
  ordem: number;
  valor: number;
}

export interface NovaAvaliacaoInput {
  titulo: string;
  disciplina: string;
  disciplinaId: string | null;
  bimestreId: number | null;
  instrucoes: string;
  valorTotal: number;
  modo: ModoAvaliacao;
  tipo: TipoAvaliacao;
  dataAplicacao: string | null;
  prazoEntrega: string | null;
  turmaIds: string[];
  questoes: AvaliacaoQuestaoInput[];
  embaralhar: ModoEmbaralhar;
  qtdVersoes: number;
  cartaoSeparado: boolean;
  modoNota: ModoNota;
  ponderadaEscopo: PonderadaEscopo;
  lancarNoBoletim: boolean;
}

// Vem de rpc_minhas_avaliacoes_aluno — nunca contém gabarito.
export interface AvaliacaoAluno {
  avaliacao_id: string;
  titulo: string;
  disciplina: string | null;
  valor_total: number;
  status: StatusAvaliacao;
  prazo_entrega: string | null;
  data_aplicacao: string | null;
  resposta_status: 'PENDENTE' | 'ENVIADA';
  nota: number | null;
}

// Vem de rpc_questoes_avaliacao_aluno — sem correct_letter/explanation.
export interface QuestaoParaAluno {
  question_id: string;
  ordem: number;
  valor: number;
  statement: string;
  image_url: string | null;
  tipo: TipoQuestao;
  /** `[]` em dissertativa/redação. */
  alternatives: { letter: string; text: string; image_url?: string | null }[];
  linhas_resposta: number | null;
  support_text_content: string | null;
  support_text_image_url: string | null;
  ja_respondida: boolean;
  letra_marcada: string | null;
  /** Resposta escrita já enviada (dissertativa/redação). */
  resposta_texto?: string | null;
}

// Um item do payload de rpc_submeter_resposta_avaliacao: `letra` para objetiva,
// `texto` para dissertativa/redação — nunca os dois.
export interface RespostaEnvio {
  question_id: string;
  letra?: string;
  texto?: string;
}

// prova_respostas.status_correcao: AUTOMATICA quando a prova só tem objetivas;
// PENDENTE enquanto houver item escrito sem nota; CORRIGIDA depois de todos.
export type StatusCorrecao = 'AUTOMATICA' | 'PENDENTE' | 'CORRIGIDA';

// Vem de rpc_itens_pendentes_correcao(p_prova_id) — uma linha por resposta escrita
// de aluno que o professor precisa pontuar.
export interface ItemPendenteCorrecao {
  item_id: string;
  aluno_id: string;
  aluno_nome: string;
  turma_nome: string | null;
  question_id: string;
  ordem: number;
  valor: number;
  tipo: TipoQuestao;
  statement: string;
  criterios_correcao: string | null;
  resposta_texto: string | null;
  corrigido: boolean;
  valor_obtido: number | null;
  observacao_professor: string | null;
}

// Vem de rpc_submeter_resposta_avaliacao.
export interface ItemResultadoSubmissao {
  question_id: string;
  letra_marcada: string | null;
  correct_letter: string | null;
  correta: boolean;
  valor_obtido: number;
  nota_final: number;
}

export interface ResultadoAluno {
  aluno_id: string;
  aluno_nome: string;
  turma_nome: string | null;
  nota: number | null;
  finalizado_em: string | null;
}

export interface RespostaItemAluno {
  question_id: string;
  letra_marcada: string | null;
  correta: boolean;
  valor_obtido: number;
}

export interface QuestaoInfoRelatorio {
  question_id: string;
  ordem: number;
  valor: number;
  correct_letter?: string;
  statement?: string;
}

export interface ResultadoAlunoDetalhado {
  aluno_id: string;
  aluno_nome: string;
  codigo_sgde?: string | null;
  turma_nome: string | null;
  /**
   * A nota que vale para esta prova. Numa prova PONDERADA já vem convertida: o relatório
   * inteiro (tabelas, médias, XLSX, impressão) lê este campo, então normalizar na entrada
   * evita ter que lembrar de aplicar a regra em cada um dos seis lugares que a usam.
   */
  nota: number | null;
  /** A soma crua dos acertos, preservada quando `nota` foi substituída pela ponderada. */
  nota_bruta?: number | null;
  nota_ponderada?: number | null;
  finalizado_em: string | null;
  respostas: Record<string, RespostaItemAluno>;
  total_acertos: number;
  total_questoes: number;
}

export interface RelatorioAvaliacaoCompleto {
  questoes: QuestaoInfoRelatorio[];
  alunos: ResultadoAlunoDetalhado[];
}

// ---- Simulado público (sem login, ver rpc_simulado_publico_iniciar) ----

export interface SimuladoPublicoAluno {
  nome: string;
  numero_chamada: number | null;
  turma: string | null;
  serie: string | null;
}

export interface SimuladoPublicoProva {
  id: string;
  titulo: string;
  disciplina: string | null;
  instrucoes: string | null;
  valor_total: number;
  status: StatusAvaliacao;
}

export interface SimuladoPublicoQuestao {
  question_id: string;
  ordem: number;
  valor: number;
  statement: string;
  image_url: string | null;
  alternatives: { letter: string; text: string; image_url?: string | null }[];
  support_text_content: string | null;
  support_text_image_url: string | null;
}

export interface SimuladoPublicoIniciarResposta {
  prova: SimuladoPublicoProva;
  aluno: SimuladoPublicoAluno;
  ja_enviado: boolean;
  nota: number | null;
  questoes: SimuladoPublicoQuestao[];
}

export interface SimuladoPublicoItemResultado {
  question_id: string;
  letra_marcada: string | null;
  correct_letter: string;
  correta: boolean;
  valor_obtido: number;
}

export interface SimuladoPublicoSubmeterResposta {
  nota_final: number;
  itens: SimuladoPublicoItemResultado[];
}

// ---- Avaliações Colaborativas de Área (PCA) ----

export interface ProvaAreaCota {
  id?: string;
  professor_id: string;
  professor_nome?: string;
  disciplina_id: string;
  disciplina_nome?: string;
  qtd_questoes: number;
  qtd_inserida: number;
  eh_minha_cota?: boolean;
}

export interface CotaProfessorInput {
  professor_id: string;
  disciplina_id: string;
  qtd_questoes: number;
}

export interface NovaAvaliacaoAreaInput {
  titulo: string;
  area_conhecimento: string;
  bimestre_id: number;
  valor_total: number;
  modo: ModoAvaliacao;
  tipo: TipoAvaliacao;
  data_aplicacao?: string | null;
  prazo_entrega?: string | null;
  instrucoes?: string | null;
  turma_ids: string[];
  cotas: CotaProfessorInput[];
}

export interface AvaliacaoArea {
  id: string;
  titulo: string;
  area_conhecimento: string;
  bimestre_id: number;
  valor_total: number;
  modo: ModoAvaliacao;
  tipo: TipoAvaliacao;
  status: StatusAvaliacao;
  status_colaboracao: 'EM_ELABORACAO' | 'PRONTA_PARA_PUBLICAR' | 'PUBLICADA';
  data_aplicacao: string | null;
  prazo_entrega: string | null;
  instrucoes: string | null;
  created_at: string;
  total_questoes: number;
  turma_nomes?: string[];
  cotas?: ProvaAreaCota[];
  edicao_bloqueada: boolean;
  prazo_edicao_area: string | null;
  /** Já calculado no backend: !edicao_bloqueada && (sem prazo ou prazo no futuro). */
  edicao_permitida: boolean;
}
