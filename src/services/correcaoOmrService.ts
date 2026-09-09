import { supabase } from '../lib/supabase';
import type {
  AlocacaoProva,
  ConfigCorrecaoProva,
  FolhaIdentificada,
  LinhaGabarito,
  ProgressoCorrecao,
  ResultadoAnulacaoItem,
  ResultadoCorrecaoOmr,
  ResumoVersao,
} from '../types/correcaoOmr';

// Envelope das RPCs de correção óptica (create_correcao_omr.sql). Toda a lógica que
// decide acerto/erro e nota mora no banco; este arquivo só transporta — é a mesma
// divisão de avaliacoesService.ts com rpc_submeter_resposta_avaliacao, e pela mesma
// razão: o gabarito não passa pelo navegador.

/** Grava a configuração de versões/nota. Não gera as versões — isso é um passo à parte. */
export async function salvarConfigCorrecao(provaId: string, config: ConfigCorrecaoProva): Promise<void> {
  const { error } = await supabase
    .from('provas')
    .update({
      embaralhar: config.embaralhar,
      qtd_versoes: config.qtd_versoes,
      cartao_separado: config.cartao_separado,
      cartao_posicao: config.cartao_posicao,
      modo_nota: config.modo_nota,
      ponderada_escopo: config.ponderada_escopo,
      lancar_no_boletim: config.lancar_no_boletim,
    })
    .eq('id', provaId);
  if (error) throw error;
}

/**
 * Sorteia as versões e distribui os alunos. Refaz tudo a cada chamada — inclusive os
 * códigos de QR —, então só deve ser chamada antes de imprimir. O banco recusa se já
 * houver cartão corrigido.
 */
export async function gerarVersoes(provaId: string): Promise<ResumoVersao[]> {
  const { data, error } = await supabase.rpc('rpc_gerar_versoes_prova', { p_prova_id: provaId });
  if (error) throw error;
  return (data ?? []) as ResumoVersao[];
}

/** As folhas a imprimir: um registro por aluno das turmas da prova. */
export async function listarAlocacoes(provaId: string): Promise<AlocacaoProva[]> {
  const { data, error } = await supabase.rpc('rpc_alocacoes_prova', { p_prova_id: provaId });
  if (error) throw error;
  return (data ?? []) as AlocacaoProva[];
}

/**
 * Aloca só quem ainda não tem folha (aluno matriculado depois do sorteio original),
 * numa versão já existente — ao contrário de gerarVersoes, não mexe em ninguém que já
 * tinha alocação, então não invalida folha já impressa. Devolve os alunos que entraram
 * agora, para a tela filtrar e imprimir só a folha deles.
 */
export async function adicionarAlunosNovos(provaId: string): Promise<{ aluno_id: string; aluno_nome: string }[]> {
  const { data, error } = await supabase.rpc('rpc_adicionar_alunos_prova', { p_prova_id: provaId });
  if (error) throw error;
  return (data ?? []) as { aluno_id: string; aluno_nome: string }[];
}

/**
 * Quantos alunos ativos (exclui transferido/remanejado, mesmo critério de
 * rpc_gerar_versoes_prova) as turmas dadas têm hoje. Usado para sugerir qtd_versoes
 * quando o professor escolhe "uma versão por aluno" em vez de um número fixo.
 */
export async function contarAlunosAtivosTurmas(turmaIds: string[]): Promise<number> {
  if (turmaIds.length === 0) return 0;
  const { data, error } = await supabase.rpc('rpc_contar_alunos_ativos_turmas', { p_turma_ids: turmaIds });
  if (error) throw error;
  return (data ?? 0) as number;
}

/** Gabarito de uma versão, linha a linha, já com a bolha correta da folha impressa. */
export async function obterGabaritoVersao(provaId: string, rotulo: string): Promise<LinhaGabarito[]> {
  const { data, error } = await supabase.rpc('rpc_gabarito_versao', { p_prova_id: provaId, p_rotulo: rotulo });
  if (error) throw error;
  return (data ?? []) as LinhaGabarito[];
}

/** Quem é o dono deste cartão. Chamada assim que o QR é lido, antes de corrigir. */
export async function identificarFolha(codigo: string): Promise<FolhaIdentificada> {
  const { data, error } = await supabase.rpc('rpc_identificar_folha', { p_codigo: codigo });
  if (error) throw error;
  return data as FolhaIdentificada;
}

/**
 * Manda as bolhas lidas e recebe o resultado já corrigido.
 * `marcacoes` vai na ordem das linhas do cartão: 'A'..'E', '' (branco) ou '*' (dupla).
 */
export async function corrigirPorOmr(
  codigo: string,
  marcacoes: string[],
  origem: 'CAMERA' | 'MANUAL' = 'CAMERA'
): Promise<ResultadoCorrecaoOmr> {
  const { data, error } = await supabase.rpc('rpc_corrigir_omr', {
    p_codigo: codigo,
    p_marcacoes: marcacoes,
    p_origem: origem,
  });
  if (error) throw error;
  return data as ResultadoCorrecaoOmr;
}

/**
 * Anula (ou reverte) manualmente uma questão de um aluno já corrigido — para o caso do
 * professor exigir a resolução no papel: o aluno marcou a bolha certa, mas sem
 * desenvolver, e o professor não quer dar o ponto mesmo assim.
 */
export async function anularItemProva(
  provaId: string,
  alunoId: string,
  questionId: string,
  anular: boolean
): Promise<ResultadoAnulacaoItem> {
  const { data, error } = await supabase.rpc('rpc_anular_item_prova', {
    p_prova_id: provaId,
    p_aluno_id: alunoId,
    p_question_id: questionId,
    p_anular: anular,
  });
  if (error) throw error;
  return data as ResultadoAnulacaoItem;
}

/** Quem já teve o cartão lido e quem falta. */
export async function obterProgressoCorrecao(provaId: string): Promise<ProgressoCorrecao[]> {
  const { data, error } = await supabase.rpc('rpc_progresso_correcao', { p_prova_id: provaId });
  if (error) throw error;
  return (data ?? []) as ProgressoCorrecao[];
}

/** Recalcula as notas ponderadas da prova inteira. */
export async function recalcularPonderada(provaId: string): Promise<number> {
  const { data, error } = await supabase.rpc('rpc_recalcular_ponderada', { p_prova_id: provaId });
  if (error) throw error;
  return (data as number) ?? 0;
}

/**
 * Erro específico de "já existe nota diferente lançada" — rpc_lancar_notas_boletim
 * recusa substituir sem confirmação explícita. `conflitos` é quantos alunos têm nota
 * preenchida e diferente da que seria lançada agora, para a tela perguntar com número.
 */
export class ConfirmacaoSubstituicaoError extends Error {
  conflitos: number;
  constructor(conflitos: number) {
    super(`${conflitos} nota(s) já preenchida(s) seria(m) substituída(s).`);
    this.name = 'ConfirmacaoSubstituicaoError';
    this.conflitos = conflitos;
  }
}

/**
 * Copia as notas para "Notas e Avaliações". Devolve quantas foram lançadas.
 * Lança ConfirmacaoSubstituicaoError se isso for substituir nota(s) já preenchida(s)
 * e `confirmarSubstituicao` não tiver sido passado — quem chama decide se pergunta ao
 * professor e chama de novo com true, ou se já confirma direto (ex.: correção acabada
 * de fazer no Modo Correção, onde a substituição É o resultado esperado).
 */
export async function lancarNotasNoBoletim(provaId: string, confirmarSubstituicao = false): Promise<number> {
  const { data, error } = await supabase.rpc('rpc_lancar_notas_boletim', {
    p_prova_id: provaId,
    p_confirmar_substituicao: confirmarSubstituicao,
  });
  if (error) {
    const msg = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error);
    const m = msg.match(/^CONFIRMACAO_SUBSTITUICAO:(\d+)/);
    if (m) throw new ConfirmacaoSubstituicaoError(Number(m[1]));
    throw error;
  }
  return (data as number) ?? 0;
}

/**
 * Link direto do modo correção, para o professor abrir no celular já com a prova
 * escolhida — abrir o portal e navegar até aqui no celular, de pé na sala com a pilha
 * de cartões na mão, é justamente o que a tela existe para evitar.
 */
export function linkModoCorrecao(provaId: string): string {
  return `${window.location.origin}/?modulo=correcao&prova=${provaId}`;
}
