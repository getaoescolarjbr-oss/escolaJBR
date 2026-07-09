export type TipoOrgaoColegiado = 'COLEGIADO_ESCOLAR' | 'APM' | 'GREMIO';

export interface OrgaoColegiado {
  id: string;
  tipo: TipoOrgaoColegiado;
  nome: string;
  mandato_inicio: string | null;
  mandato_fim: string | null;
  cnpj: string | null;
  estatuto_doc_path: string | null;
  ativo: boolean;
  criado_em: string;
}

export type SegmentoMembro = 'DOCENTE' | 'ESPECIALISTA' | 'FUNCIONARIO' | 'PAIS' | 'ALUNO';
export type FuncaoMembro = 'PRESIDENTE' | 'SECRETARIO' | 'CONSELHEIRO' | 'DIRETORIA' | 'CONSELHO_FISCAL';
export type TitularSuplente = 'TITULAR' | 'SUPLENTE';

export interface MembroColegiado {
  id: string;
  orgao_id: string;
  pessoa_id: string;
  segmento: SegmentoMembro;
  funcao: FuncaoMembro;
  titular_ou_suplente: TitularSuplente;
  mandato_inicio: string;
  mandato_fim: string;
  // Diretor/Diretor-Adjunto: secretários executivos do Colegiado Escolar, sem
  // direito a voto na presidência — ficam fora do cálculo de paridade 50/50.
  membro_nato: boolean;
  criado_em: string;
}

export type TipoReuniao = 'ORDINARIA' | 'EXTRAORDINARIA' | 'ASSEMBLEIA';
export type StatusReuniao = 'AGENDADA' | 'REALIZADA' | 'ATA_EMITIDA';

export interface ReuniaoColegiado {
  id: string;
  orgao_id: string;
  tipo: TipoReuniao;
  data: string;
  pauta: string | null;
  status: StatusReuniao;
  ata_id: string | null;
  criado_por: string;
  criado_em: string;
}

export interface ReuniaoPresenca {
  id: string;
  reuniao_id: string;
  membro_id: string;
  presente: boolean;
}

export interface Deliberacao {
  id: string;
  reuniao_id: string;
  descricao: string;
  resultado: string | null;
  criado_em: string;
}

export interface AtaColegiado {
  id: string;
  reuniao_id: string;
  orgao_id: string;
  titulo: string;
  conteudo_gerado: string;
  numero_sequencial: number;
  ano_letivo: number;
  created_by: string;
  created_at: string;
}

export type TipoComunicado = 'COMUNICADO' | 'CONVOCACAO' | 'EVENTO';
export type DestinoComunicado = 'TODOS' | 'SEGMENTO' | 'TURMA' | 'ORGAO';
export type StatusComunicado = 'RASCUNHO' | 'PUBLICADO';

export interface Comunicado {
  id: string;
  tipo: TipoComunicado;
  titulo: string;
  corpo: string | null;
  destino: DestinoComunicado;
  destino_ref: string | null;
  autor_id: string;
  publicado_em: string | null;
  status: StatusComunicado;
  criado_em: string;
}
