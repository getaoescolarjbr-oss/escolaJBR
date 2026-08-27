export type ModoAvaliacao = 'IMPRESSA' | 'ONLINE' | 'AMBAS';
export type StatusAvaliacao = 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA';

export interface Avaliacao {
  id: string;
  titulo: string;
  disciplina: string | null;
  disciplina_id: string | null;
  bimestre_id: number | null;
  instrucoes: string | null;
  valor_total: number;
  modo: ModoAvaliacao;
  data_aplicacao: string | null;
  prazo_entrega: string | null;
  status: StatusAvaliacao;
  criado_por: string;
  created_at: string;
  updated_at: string;
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
  dataAplicacao: string | null;
  prazoEntrega: string | null;
  turmaIds: string[];
  questoes: AvaliacaoQuestaoInput[];
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
  alternatives: { letter: string; text: string; image_url?: string | null }[];
  support_text_content: string | null;
  support_text_image_url: string | null;
  ja_respondida: boolean;
  letra_marcada: string | null;
}

export interface RespostaEnvio {
  question_id: string;
  letra: string;
}

// Vem de rpc_submeter_resposta_avaliacao.
export interface ItemResultadoSubmissao {
  question_id: string;
  letra_marcada: string | null;
  correct_letter: string;
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
