export const TYPES_VERSION = '1.0.0';

export interface Aluno {
  id: string;
  aluno_id?: string;
  nome: string;
  cid_codigo?: string;
  cid_descricao?: string;
  foto_url?: string;
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
  config_turmas?: Record<string, { config_visto_metodo: 'gradual' | 'simbolico' | 'aberto' | 'ponto'; config_visto_valor_total: number }>;
  bimestre_atual: number;
  data_nascimento?: string;
  publicar_aniversario?: boolean;
  status_servidor?: string;
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
  status?: MatriculaStatus;
  atestado_inicio?: string;
  atestado_fim?: string;
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

export type MatriculaStatus = 'Ativo' | 'Transferido' | 'Remanejado' | 'Atestado' | 'Cancelada' | 'Suspenso' | 'Aluno Suspenso' | 'Licença Maternidade';

export interface Student {
  id: string;
  nome: string;
  aluno_numero: number;
  turma_id: string;
  status: MatriculaStatus;
  atestado_inicio?: string;
  atestado_fim?: string;
  created_at: string;
  cid_codigo?: string;
  cid_descricao?: string;
  foto_url?: string;
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

export interface AtestadoServidor {
  id: string;
  professor_id: string;
  substituto_id?: string | null;
  data_inicio: string;
  data_fim: string;
  observacoes?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at?: string;
  // joins opcionais
  professor_nome?: string;
  substituto_nome?: string;
}

export interface AlocacaoEspelho {
  id: string;
  professor_id: string;
  turma_id: string;
  disciplina_id: string;
  is_espelho: boolean;
  atestado_id?: string | null;
  professor_original_id?: string | null;
  professor_nome?: string;
  turma_nome?: string;
  disciplina_nome?: string;
  professor_original_nome?: string;
  // dados do atestado
  atestado_data_fim?: string;
}
