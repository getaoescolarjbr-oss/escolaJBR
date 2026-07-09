export type CategoriaBem = 'MOBILIARIO' | 'EQUIPAMENTO_ELETRONICO' | 'ELETRODOMESTICO' | 'VEICULO' | 'OUTRO';
export type SituacaoBem = 'EM_USO' | 'EM_MANUTENCAO' | 'BAIXADO' | 'EXTRAVIADO';

export interface BemPatrimonial {
  id: string;
  numero_patrimonio: string;
  nome: string;
  descricao: string | null;
  categoria: CategoriaBem;
  local_atual: string;
  responsavel_id: string | null;
  data_aquisicao: string | null;
  valor_aquisicao: number | null;
  fonte_recurso: string | null;
  situacao: SituacaoBem;
  observacoes: string | null;
  ativo: boolean;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface HistoricoBemPatrimonial {
  id: string;
  bem_id: string;
  campo: 'CRIACAO' | 'SITUACAO' | 'LOCAL';
  valor_anterior: string | null;
  valor_novo: string;
  alterado_por: string | null;
  alterado_em: string;
}
