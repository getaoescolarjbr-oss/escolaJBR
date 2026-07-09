export type CategoriaMaterial = 'EXPEDIENTE' | 'LIMPEZA' | 'OUTRO';

export interface Material {
  id: string;
  nome: string;
  categoria: CategoriaMaterial;
  unidade: string;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: string;
}

export interface MaterialComSaldo extends Material {
  saldo: number;
}

export type TipoMovimentacaoMaterial = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

export interface MovimentacaoMaterial {
  id: string;
  material_id: string;
  tipo: TipoMovimentacaoMaterial;
  quantidade: number;
  motivo: string | null;
  referencia: string | null;
  fonte_recurso: string | null;
  criado_por: string | null;
  criado_em: string;
}

export type StatusRequisicao = 'PENDENTE' | 'ATENDIDA' | 'RECUSADA';

export interface Requisicao {
  id: string;
  solicitante_id: string;
  setor: string;
  status: StatusRequisicao;
  observacao_recusa: string | null;
  criado_em: string;
  atendida_por: string | null;
  atendida_em: string | null;
}

export interface RequisicaoItem {
  id: string;
  requisicao_id: string;
  material_id: string;
  quantidade_solicitada: number;
  quantidade_atendida: number | null;
}
