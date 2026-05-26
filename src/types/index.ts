export const TYPES_VERSION = '1.0.0';

export interface Aluno {
  id: string;
  aluno_id?: string;
  nome: string;
}

export interface Professor {
  id: string;
  user_id: string;
  nome: string;
  email?: string;
  telefone?: string;
  habilitar_chamada_interna: boolean;
  cargo: string;
  area_conhecimento?: string;
  config_visto_metodo: 'gradual' | 'simbolico' | 'aberto' | 'ponto';
  config_visto_valor_total: number;
  bimestre_atual: number;
}

export interface ListaParaVistos {
  professor_id: string;
  professor_nome: string;
  disciplina_id: string;
  disciplina_nome: string;
  turma_id: string;
  turma_nome: string;
  aluno_id: string;
  aluno_nome: string;
  aluno_numero?: number;
}

export interface Chamada {
  aluno_id: string;
  id_do_professor: string;
  disciplina_id: string;
  turma_id: string;
  presenca: boolean;
  data_aula: string;
}

export interface Visto {
  aluno_id: string;
  id_do_professor: string;
  disciplina_id: string;
  turma_id: string;
  status: 'Visto' | 'Não Fez';
  data_visto: string;
}

export interface AtividadeDiaria {
  id: string;
  id_do_professor: string;
  turma_id: string;
  disciplina_id: string;
  bimestre_id: number;
  data: string;
  descricao: string;
}

export interface VistoV2 {
  id: string;
  atividade_id: string;
  aluno_id: string;
  valor: string;
}

export interface Avaliacao {
  id: string;
  professor_id: string;
  turma_id: string;
  disciplina_id: string;
  bimestre_id: number;
  nome: string;
  valor_maximo: number;
  data_avaliacao?: string;
  publicada?: boolean;
}

export interface NotaAvaliacao {
  avaliacao_id: string;
  aluno_id: string;
  nota: number;
}

export type MatriculaStatus = 'Ativo' | 'Transferido' | 'Remanejado' | 'Atestado' | 'Cancelada';

export interface Student {
  id: string;
  nome: string;
  aluno_numero: number;
  turma_id: string;
  status: MatriculaStatus;
  atestado_inicio?: string;
  atestado_fim?: string;
  created_at: string;
}

export interface Turma {
  id: string;
  nome: string;
  created_at?: string;
}

export interface Disciplina {
  id: string;
  nome: string;
}

export interface Ocorrencia {
  aluno_id: string;
  id_do_professor: string;
  disciplina_id: string;
  turma_id: string;
  descricao: string;
  data_registro: string;
}

export interface SaidaSala {
  id?: string;
  aluno_id: string;
  id_do_professor: string;
  disciplina_id: string;
  turma_id: string;
  destino: string;
  hora_saida: string;
  hora_retorno?: string;
  status: 'Fora' | 'Retornou';
}
