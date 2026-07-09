export type TipoConsentimento = 'CADASTRO' | 'USO_IMAGEM' | 'DADOS_SENSIVEIS';

export interface Consentimento {
  id: string;
  pessoa_id: string;
  tipo: TipoConsentimento;
  aceito: boolean;
  aceito_por_pessoa_id: string;
  versao_termo: string;
  criado_em: string;
}

export type TipoSolicitacaoLgpd = 'EXPORTAR' | 'EXCLUIR';
export type StatusSolicitacaoLgpd = 'PENDENTE' | 'CONCLUIDA' | 'NEGADA';

export interface SolicitacaoLgpd {
  id: string;
  pessoa_id: string;
  tipo: TipoSolicitacaoLgpd;
  status: StatusSolicitacaoLgpd;
  solicitado_por: string;
  solicitado_em: string;
  concluido_em: string | null;
  observacoes: string | null;
}
