export type TipoRecurso = 'LABORATORIO' | 'SALA' | 'QUADRA' | 'EQUIPAMENTO' | 'OUTRO';

export interface Recurso {
  id: string;
  nome: string;
  tipo: TipoRecurso;
  descricao: string | null;
  capacidade: number | null;
  local: string | null;
  icone: string | null;
  cor: string | null;
  ordem: number;
  requer_aprovacao: boolean;
  ativo: boolean;
  em_manutencao: boolean;
  criado_em: string;
}

export interface BloqueioRecurso {
  id: string;
  recurso_id: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
  criado_por: string;
  criado_em: string;
}

export type StatusReserva = 'CONFIRMADA' | 'PENDENTE' | 'RECUSADA' | 'CANCELADA';

export interface Reserva {
  id: string;
  recurso_id: string;
  professor_id: string;
  turma_id: string | null;
  finalidade: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: StatusReserva;
  aprovado_por: string | null;
  aprovado_em: string | null;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  serie_id: string | null;
  tema: string | null;
  objetivos: string | null;
}

export type StatusSerie = 'ATIVA' | 'CANCELADA';

export interface SerieReserva {
  id: string;
  recurso_id: string;
  professor_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  turma_id: string | null;
  finalidade: string | null;
  status: StatusSerie;
  criado_por: string;
  criado_em: string;
}

export interface OcorrenciaSerieResultado {
  data: string;
  sucesso: boolean;
  motivo: string | null;
  reserva_id: string | null;
}

export type TipoCampoPersonalizado = 'TEXTO' | 'NUMERO' | 'DATA' | 'BOOLEANO' | 'SELECAO';

export interface CampoPersonalizado {
  id: string;
  recurso_id: string | null;
  nome: string;
  tipo: TipoCampoPersonalizado;
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
  criado_em: string;
}

export interface ReservaValorPersonalizado {
  id: string;
  reserva_id: string;
  campo_id: string;
  valor: string | null;
}

export interface ReservaCompartilhamento {
  id: string;
  reserva_id: string;
  compartilhado_com_usuario_id: string;
  compartilhado_por: string;
  criado_em: string;
}

export interface DashboardDiaLinha {
  recurso_id: string;
  recurso_nome: string;
  reserva_id: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  status: StatusReserva | null;
  professor_nome: string | null;
  turma_nome: string | null;
  finalidade: string | null;
  tema: string | null;
}

export interface ValidacaoLinhaRecurso {
  linha: number;
  valido: boolean;
  motivo: string | null;
  duplicado: boolean;
  nome: string | null;
}

export interface ImportacaoLinhaRecurso {
  linha: number;
  sucesso: boolean;
  motivo: string | null;
  recurso_id: string | null;
}

export interface ValidacaoLinhaSerie {
  linha: number;
  valido: boolean;
  motivo: string | null;
  recurso_nome: string | null;
  professor_nome: string | null;
  turma_nome: string | null;
  conflitos_previstos: number;
}

export interface ImportacaoLinhaSerie {
  linha: number;
  sucesso: boolean;
  motivo: string | null;
  serie_id: string | null;
  ocorrencias_criadas: number;
  ocorrencias_com_conflito: number;
}

export interface DisponibilidadeSlot {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: 'RESERVA' | 'BLOQUEIO';
}

export interface RelatorioPorRecurso {
  recurso_id: string;
  nome: string;
  total_reservas: number;
  horas_reservadas: number;
  taxa_ocupacao: number;
}

export interface RelatorioHorarioPico {
  hora_inicio: string;
  total: number;
}

export interface RelatorioPorProfessor {
  professor_id: string;
  nome: string;
  total_reservas: number;
}

export interface RelatorioPorTurma {
  turma_id: string;
  nome: string;
  total_reservas: number;
}

export interface RelatorioAgendamento {
  periodo_dias_uteis: number;
  horas_uteis_periodo_por_recurso: number;
  por_recurso: RelatorioPorRecurso[] | null;
  horarios_pico: RelatorioHorarioPico[] | null;
  por_professor: RelatorioPorProfessor[] | null;
  por_turma: RelatorioPorTurma[] | null;
}
