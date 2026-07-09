export type TurnoJornada = 'Matutino' | 'Vespertino' | 'Noturno' | 'Integral';

export interface JornadaServidor {
  id: string;
  servidor_id: string;
  turno: TurnoJornada;
  dias_semana: number[];
  hora_inicio: string;
  hora_fim: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  criado_em: string;
}

export type StatusFrequencia = 'PRESENTE' | 'AUSENTE' | 'ATRASO' | 'ABONADA' | 'AFASTADO';
export type VinculoFrequencia = 'SERVIDOR' | 'TERCEIRIZADO';

export interface FrequenciaServidor {
  id: string;
  vinculo: VinculoFrequencia;
  servidor_id: string | null;
  terceirizado_id: string | null;
  data: string;
  status: StatusFrequencia;
  entrada: string | null;
  saida: string | null;
  justificativa: string | null;
  registrado_por: string;
  criado_em: string;
}

export type FuncaoTerceirizado = 'LIMPEZA' | 'MERENDA' | 'VIGILANCIA' | 'OUTRO';

export interface Terceirizado {
  id: string;
  nome: string;
  empresa: string | null;
  funcao: FuncaoTerceirizado;
  contato: string | null;
  ativo: boolean;
  criado_em: string;
}

export type TipoAusencia = 'ATESTADO' | 'LICENCA' | 'FERIAS' | 'FALTA' | 'OUTRO';
export type StatusOficialAusencia = 'INTERNO' | 'ENVIADO_SED' | 'DEFERIDO' | 'PUBLICADO_DO';

export interface AusenciaServidor {
  id: string;
  professor_id: string;
  substituto_id: string | null;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
  ativo: boolean;
  tipo: TipoAusencia;
  status_oficial: StatusOficialAusencia;
  processo_sed_ref: string | null;
  documento_path: string | null;
  created_at: string;
  updated_at: string;
}

export type StatusSubstituicao = 'ARRANJO_INTERNO' | 'FORMALIZADA_SED';

export interface Substituicao {
  id: string;
  servidor_ausente_id: string;
  substituto_id: string | null;
  turma_id: string | null;
  aula_ref: string | null;
  data: string;
  status: StatusSubstituicao;
  observacoes: string | null;
  registrado_por: string;
  criado_em: string;
}
