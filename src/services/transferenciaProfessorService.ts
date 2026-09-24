import { supabase } from '../lib/supabase';

// Transferência DEFINITIVA de turmas e diário de um professor para outro (saída da escola).
// A regra está no banco (add_transferencia_professor.sql): só GESTAO, numa transação, com
// simulação e com registro de cada linha movida para poder desfazer.

export interface ResultadoTransferencia {
  simulado: boolean;
  transferencia_id?: string;
  origem: { id: string; nome: string };
  destino: { id: string; nome: string };
  contagens: Record<string, number>;
  conflitos: Record<string, number>;
  avisos: string[];
}

export const ROTULOS_CONTAGEM: Record<string, string> = {
  alocacoes: 'Turmas e disciplinas (alocações)',
  alocacoes_que_o_destino_ja_tinha: 'Alocações que o destino já tinha (não duplica)',
  atividades: 'Atividades do diário',
  vistos_dos_alunos_nas_atividades: 'Vistos dos alunos (acompanham as atividades)',
  avaliacoes: 'Avaliações / campos de nota',
  notas_dos_alunos_nas_avaliacoes: 'Notas dos alunos (acompanham as avaliações)',
  chamadas: 'Chamadas (presença)',
  horarios: 'Horários de aula',
  cotas_de_avaliacao_da_area: 'Cotas de questões em avaliações da área',
  recebe_nota_em_avaliacoes: 'Recebe a nota em avaliações da área',
  corretor_de_turma: 'Corretor de turma',
  ocorrencias: 'Ocorrências registradas por ele',
  turmas_com_configuracao_de_vistos_copiada: 'Turmas com a configuração de vistos copiada',
};

export const ROTULOS_CONFLITO: Record<string, string> = {
  cotas_de_avaliacao: 'Cotas de avaliação que o destino já tem (impede transferir)',
  recebe_nota_em_avaliacoes: 'Avaliações em que o destino já recebe a nota (impede transferir)',
  horarios_no_mesmo_dia_e_tempo: 'Horários no mesmo dia e tempo que o destino já tem (aviso)',
  configuracao_de_vistos_diferente: 'Turmas com configuração de vistos diferente no destino (aviso)',
};

function mensagem(error: { message?: string } | null): string {
  return error?.message ?? 'Erro desconhecido.';
}

export async function simularTransferencia(origemId: string, destinoId: string, incluirOcorrencias: boolean): Promise<ResultadoTransferencia> {
  const { data, error } = await supabase.rpc('rpc_transferir_professor', {
    p_origem: origemId, p_destino: destinoId, p_simular: true, p_incluir_ocorrencias: incluirOcorrencias, p_observacao: null,
  });
  if (error) throw new Error(mensagem(error));
  return data as ResultadoTransferencia;
}

export async function executarTransferencia(origemId: string, destinoId: string, incluirOcorrencias: boolean, observacao: string): Promise<ResultadoTransferencia> {
  const { data, error } = await supabase.rpc('rpc_transferir_professor', {
    p_origem: origemId, p_destino: destinoId, p_simular: false, p_incluir_ocorrencias: incluirOcorrencias, p_observacao: observacao.trim() || null,
  });
  if (error) throw new Error(mensagem(error));
  return data as ResultadoTransferencia;
}

export async function desfazerTransferencia(id: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_desfazer_transferencia', { p_id: id });
  if (error) throw new Error(mensagem(error));
}

export interface RegistroTransferencia {
  id: string;
  origem_id: string;
  destino_id: string;
  origem_nome: string | null;
  destino_nome: string | null;
  feito_em: string;
  observacao: string | null;
  desfeita_em: string | null;
}

export async function listarTransferencias(origemId?: string): Promise<RegistroTransferencia[]> {
  let consulta = supabase
    .from('professor_transferencias')
    .select('id, origem_id, destino_id, origem_nome, destino_nome, feito_em, observacao, desfeita_em')
    .order('feito_em', { ascending: false });
  if (origemId) consulta = consulta.eq('origem_id', origemId);
  const { data, error } = await consulta;
  if (error) throw new Error(mensagem(error));
  return (data ?? []) as RegistroTransferencia[];
}
