export type GrupoPrioritario = 'ASSENTAMENTO' | 'INDIGENA' | 'QUILOMBOLA' | 'MULHERES' | 'JOVENS';

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj_cpf: string | null;
  agricultura_familiar: boolean;
  dap_caf_numero: string | null;
  contato: string | null;
  grupo_prioritario: GrupoPrioritario | null;
  ativo: boolean;
  criado_em: string;
}

export interface NotaFiscal {
  id: string;
  fornecedor_id: string;
  numero: string;
  data: string;
  valor: number;
  arquivo_path: string | null;
  registrado_por: string;
  criado_em: string;
}

export type UnidadeMedida = 'KG' | 'LITRO' | 'UNIDADE' | 'PACOTE' | 'CAIXA' | 'DUZIA';
export type ClassificacaoPnae = 'IN_NATURA' | 'MINIMAMENTE_PROCESSADO' | 'PROCESSADO' | 'ULTRAPROCESSADO';

export interface EstoqueItem {
  id: string;
  nome: string;
  unidade_medida: UnidadeMedida;
  classificacao_pnae: ClassificacaoPnae;
  perecivel: boolean;
  estoque_minimo: number;
  ativo: boolean;
}

export type OrigemLote = 'AGRICULTURA_FAMILIAR' | 'LICITACAO' | 'DOACAO' | 'OUTRO';
export type FonteRecurso = 'PNAE' | 'PDDE' | 'OUTRO';

export interface EstoqueLote {
  id: string;
  item_id: string;
  numero_lote: string;
  fornecedor_id: string | null;
  nota_fiscal_id: string | null;
  validade: string | null;
  valor_unitario: number | null;
  origem: OrigemLote;
  fonte_recurso: FonteRecurso;
  recebido_em: string;
  recebido_por: string;
}

export interface Nutricionista {
  pessoa_id: string;
  nome: string;
}

export type TipoMovimentacao = 'ENTRADA' | 'SAIDA' | 'PERDA' | 'AJUSTE';

export interface EstoqueMovimentacao {
  id: string;
  lote_id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  data_movimentacao: string;
  motivo: string | null;
  registrado_por: string;
  criado_em: string;
}

export interface SaldoLote {
  lote_id: string;
  item_id: string;
  numero_lote: string;
  validade: string | null;
  saldo_atual: number;
  fonte_recurso: FonteRecurso;
}

export type Turno = 'Matutino' | 'Vespertino' | 'Noturno' | 'Integral';

export interface Cardapio {
  id: string;
  data: string;
  turno: Turno;
  nutricionista_pessoa_id: string | null;
  publicado: boolean;
  observacoes: string | null;
  criado_em: string;
}

export interface CardapioItem {
  id: string;
  cardapio_id: string;
  item_id: string;
  descricao_preparacao: string | null;
  quantidade_planejada_por_aluno: number;
}

export interface RefeicaoServida {
  id: string;
  cardapio_id: string;
  quantidade_alunos: number;
  registrado_por: string;
  criado_em: string;
}

export interface IndicadoresPnae {
  valor_total: number;
  valor_in_natura_minimamente_processado: number;
  valor_ultraprocessado: number;
  valor_agricultura_familiar: number;
  valor_total_pnae: number;
}

export interface FichaTecnica {
  id: string;
  preparacao: string;
  modo_preparo: string | null;
  criado_por: string;
  criado_em: string;
}

export interface FichaIngrediente {
  id: string;
  ficha_id: string;
  item_id: string;
  per_capita: number;
}

export type TipoNecessidadeEspecial = 'ALERGIA' | 'INTOLERANCIA' | 'CELIACO' | 'DIABETES' | 'SELETIVIDADE' | 'OUTRO';

export interface NecessidadeEspecial {
  id: string;
  aluno_id: string;
  tipo: TipoNecessidadeEspecial;
  descricao: string | null;
  laudo_arquivo_path: string | null;
  adaptacao: string | null;
  consentimento_id: string | null;
  ativo: boolean;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ConciliacaoPnaeLinha {
  data: string;
  turno: Turno;
  quantidade_servida: number;
  quantidade_matriculada: number;
  divergencia: number;
}

export type TipoControleSanitario = 'HIGIENE' | 'TEMPERATURA' | 'LIMPEZA';

export interface ItemChecklist {
  item: string;
  ok: boolean;
}

export interface ControleSanitario {
  id: string;
  data: string;
  tipo: TipoControleSanitario;
  itens: ItemChecklist[];
  conforme: boolean;
  responsavel: string;
  observacoes: string | null;
  criado_em: string;
}

export interface InspecaoSanitaria {
  id: string;
  data: string;
  orgao: string;
  resultado: string;
  arquivo_path: string | null;
  registrado_por: string;
  criado_em: string;
}

export interface TesteAceitabilidade {
  id: string;
  ficha_id: string | null;
  cardapio_id: string | null;
  metodo: string;
  data: string;
  percentual_aceitacao: number;
  registrado_por: string;
  criado_em: string;
}
