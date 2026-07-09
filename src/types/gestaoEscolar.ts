// Espelha o JSON devolvido por rpc_indicadores_gestao_escolar() (ver
// create_gestao_escolar_fase1.sql). Cada indicador sem fonte de dado confiável vem
// como SemDados em vez de um número inventado.
export interface SemDados {
  sem_dados: true;
  motivo: string;
}

export type IndicadorNumerico = number | SemDados;

export function temDados(valor: IndicadorNumerico): valor is number {
  return typeof valor === 'number';
}

export interface IndicadoresGestaoEscolar {
  academico: {
    alunos_por_status: Record<string, number>;
    ocorrencias_30_dias: { total: number; sem_visto_coordenador: number };
    servidores_atestado_ativo: number;
    infrequencia_alunos: number;
    dias_letivos: SemDados;
    situacao_turmas: SemDados;
  };
  secretaria: {
    documentos_emitidos_30_dias: number;
    protocolos_por_status: Record<string, number>;
    divergencias_matricula: { total: number; matriculas_registradas: number };
  };
  biblioteca: {
    emprestimos_ativos: number;
    alunos_biblioclube: number;
    denuncias_abertas: number;
    resenhas_ocultas_revisao: number;
    resgates_pendentes: number;
  };
  operacional: {
    lotes_vencendo_7_dias: number;
    refeicoes_servidas_30_dias: number;
    reservas_pendentes: number;
  };
  almoxarifado: {
    materiais_abaixo_minimo: number;
  };
  manutencao: {
    chamados_abertos: number;
    chamados_atrasados: SemDados;
  };
  portaria: {
    visitantes_presentes: number;
  };
  patrimonio: {
    bens_em_manutencao: number;
  };
  rh: {
    frequencia_servidores_hoje: Record<string, number>;
    substituicoes_pendentes: number;
  };
  financeiro: SemDados;
  gerado_em: string;
}
