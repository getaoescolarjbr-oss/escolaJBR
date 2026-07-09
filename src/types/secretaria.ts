export interface SerieReferencia {
  id: string;
  codigo: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export type Turno = 'Matutino' | 'Vespertino' | 'Noturno' | 'Integral';
export type StatusMatricula = 'ATIVA' | 'ENCERRADA' | 'TRANSFERIDA';

export interface Matricula {
  id: string;
  pessoa_id: string;
  ano_letivo: number;
  serie_id: string;
  turno: Turno;
  data_matricula: string;
  escola_procedencia: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
  status_matricula: StatusMatricula;
  motivo_saida: string | null;
  data_saida: string | null;
  // Preenchido pelo trigger fn_matricula_exige_consentimento no servidor — o cliente
  // nunca envia isso na criação, por isso é opcional aqui (não em todo INSERT).
  consentimento_id?: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type TipoDocumentoPessoa = 'RG_CERTIDAO' | 'CPF' | 'COMPROVANTE_RESIDENCIA' | 'HISTORICO_ESCOLAR' | 'OUTRO';

export interface DocumentoPessoa {
  id: string;
  pessoa_id: string;
  tipo: TipoDocumentoPessoa;
  nome_arquivo: string;
  arquivo_path: string;
  enviado_por: string;
  enviado_em: string;
  observacoes: string | null;
}

export type TipoDocumentoEmitido = 'DECLARACAO_MATRICULA' | 'HISTORICO_ESCOLAR' | 'ATESTADO_FREQUENCIA' | 'TRANSFERENCIA';

export interface DocumentoEmitido {
  id: string;
  tipo: TipoDocumentoEmitido;
  numero: number;
  ano: number;
  pessoa_id: string;
  matricula_id: string | null;
  emitido_por: string;
  emitido_em: string;
  arquivo_path: string | null;
  dados_snapshot: Record<string, unknown>;
}

export type StatusProtocolo = 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'ARQUIVADO';

export interface Protocolo {
  id: string;
  numero: number;
  ano: number;
  tipo: string;
  assunto: string;
  interessado: string;
  pessoa_id: string | null;
  recebido_por: string;
  recebido_em: string;
  status: StatusProtocolo;
  prazo: string | null;
  encaminhamento: string | null;
  observacoes: string | null;
}

export interface AnexoProtocolo {
  id: string;
  protocolo_id: string;
  nome_arquivo: string;
  arquivo_path: string;
  enviado_por: string;
  enviado_em: string;
}

export interface DivergenciaMatricula {
  pessoa_id: string;
  pessoa_nome: string;
  aluno_id: string;
  status_operacional: string;
  status_matricula: StatusMatricula;
  ano_letivo: number;
}
