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
  bloquear_titular: boolean;
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

// Controle de lançamento de folha — professor substituto (create_folha_substituto_lancamentos.sql)
export type PagamentoSubstituto = 'SED' | 'PARTICULAR';

export interface LancamentoFolhaSubstituto {
  id: string;
  competencia: string; // AAAA-MM-01
  data: string; // dia da substituição (ou 1º dia do período)
  data_fim: string | null; // último dia do período; null = um dia só
  substituto_id: string | null;
  substituto_nome: string;
  titular_id: string | null;
  titular_nome: string;
  motivo: string;
  periodo: string | null;
  carga_horaria: number | null;
  pagamento: PagamentoSubstituto | null; // null = a definir
  termo_ok: boolean;
  justificativa_ok: boolean;
  lancado_folha: boolean;
  lancado_em: string | null;
  observacoes: string | null;
  origem: 'MANUAL' | 'ATESTADO' | 'SUBSTITUICAO';
  atestado_id: string | null;
  substituicao_id: string | null;
  registrado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type NovoLancamentoFolha = Pick<LancamentoFolhaSubstituto,
  'competencia' | 'data' | 'data_fim' | 'substituto_id' | 'substituto_nome' | 'titular_id' | 'titular_nome' | 'motivo' | 'periodo' | 'carga_horaria' | 'pagamento' | 'observacoes'>;
