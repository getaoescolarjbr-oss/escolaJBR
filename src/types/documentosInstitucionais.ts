export type TipoDocumentoInstitucional = 'PPP' | 'REGIMENTO' | 'PLANO_GESTAO' | 'ATO_NORMATIVO' | 'OUTRO';
export type VisibilidadeDocumento = 'INTERNO' | 'COMUNIDADE';

export interface DocumentoInstitucional {
  id: string;
  tipo: TipoDocumentoInstitucional;
  titulo: string;
  descricao: string | null;
  visibilidade: VisibilidadeDocumento;
  versao_vigente_id: string | null;
  criado_em: string;
}

export type StatusVersaoDocumento = 'RASCUNHO' | 'EM_APROVACAO' | 'VIGENTE' | 'SUBSTITUIDA';

export interface VersaoDocumento {
  id: string;
  documento_id: string;
  versao: number;
  arquivo_path: string | null;
  resumo_alteracoes: string | null;
  status: StatusVersaoDocumento;
  aprovado_por: string | null;
  aprovado_em: string | null;
  orgao_aprovador_id: string | null;
  criado_por: string;
  criado_em: string;
}
