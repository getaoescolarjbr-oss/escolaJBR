export type CategoriaChamado = 'ELETRICA' | 'HIDRAULICA' | 'ESTRUTURA' | 'MOBILIARIO' | 'OUTRO';
export type PrioridadeChamado = 'BAIXA' | 'MEDIA' | 'ALTA';
export type StatusChamado = 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

export interface ChamadoManutencao {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaChamado;
  local: string;
  prioridade: PrioridadeChamado;
  status: StatusChamado;
  aberto_por: string | null;
  aberto_em: string;
  responsavel_id: string | null;
  bem_patrimonial_id: string | null;
  resolvido_em: string | null;
  observacoes: string | null;
  atualizado_em: string;
}

export interface HistoricoChamado {
  id: string;
  chamado_id: string;
  status_anterior: StatusChamado | null;
  status_novo: StatusChamado;
  alterado_por: string | null;
  alterado_em: string;
  observacao: string | null;
}

export interface OrdemServico {
  id: string;
  chamado_id: string;
  responsavel: string;
  custo: number | null;
  data: string;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
}
