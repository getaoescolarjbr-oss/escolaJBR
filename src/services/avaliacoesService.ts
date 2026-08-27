import { supabase } from '../lib/supabase';
import type {
  Avaliacao,
  AvaliacaoAluno,
  ItemResultadoSubmissao,
  NovaAvaliacaoInput,
  QuestaoParaAluno,
  RespostaEnvio,
  ResultadoAluno,
  StatusAvaliacao,
} from '../types/avaliacoes';

const AVALIACAO_SELECT = 'id, titulo, disciplina, instrucoes, valor_total, modo, data_aplicacao, prazo_entrega, status, criado_por, created_at, updated_at';

function mapAvaliacaoRow(row: Record<string, unknown>): Avaliacao {
  const turmas = (row.prova_turmas as { turmas: { id: string; nome: string } | null }[] | undefined) ?? [];
  const questoes = (row.prova_questoes as { id: string }[] | undefined) ?? [];
  return {
    ...(row as unknown as Avaliacao),
    turma_ids: turmas.map((t) => t.turmas?.id).filter((id): id is string => !!id),
    turma_nomes: turmas.map((t) => t.turmas?.nome).filter((n): n is string => !!n),
    total_questoes: questoes.length,
  };
}

// Lista as avaliações do próprio professor (GESTAO/COORDENACAO veem todas, via RLS de
// provas_select_dono_ou_staff). Tabelas vivem em provas/prova_* — não em avaliacoes/
// avaliacao_*, que já pertenciam ao módulo de Notas (GradesPanel.tsx).
export async function listarMinhasAvaliacoes(): Promise<Avaliacao[]> {
  const { data, error } = await supabase
    .from('provas')
    .select(`${AVALIACAO_SELECT}, prova_turmas(turmas(id, nome)), prova_questoes(id)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapAvaliacaoRow(row as unknown as Record<string, unknown>));
}

export async function obterAvaliacao(id: string): Promise<Avaliacao | null> {
  const { data, error } = await supabase
    .from('provas')
    .select(`${AVALIACAO_SELECT}, prova_turmas(turmas(id, nome)), prova_questoes(id)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapAvaliacaoRow(data as unknown as Record<string, unknown>);
}

export async function obterQuestoesDaAvaliacao(id: string): Promise<{ question_id: string; ordem: number; valor: number }[]> {
  const { data, error } = await supabase
    .from('prova_questoes')
    .select('question_id, ordem, valor')
    .eq('prova_id', id)
    .order('ordem');
  if (error) throw error;
  return data ?? [];
}

// Cria a avaliação (rascunho) + os vínculos de questões e turmas. Não é atômico entre
// as 3 tabelas (sem transação no lado do cliente), mas provas.status só vira PUBLICADA
// depois — se algo falhar no meio, fica um rascunho incompleto, não algo visível para
// alunos.
export async function criarAvaliacao(dados: NovaAvaliacaoInput, status: StatusAvaliacao = 'RASCUNHO'): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Sessão inválida.');

  const { data: avaliacao, error: avErro } = await supabase
    .from('provas')
    .insert([{
      titulo: dados.titulo,
      disciplina: dados.disciplina || null,
      instrucoes: dados.instrucoes || null,
      valor_total: dados.valorTotal,
      modo: dados.modo,
      data_aplicacao: dados.dataAplicacao || null,
      prazo_entrega: dados.prazoEntrega || null,
      status,
      criado_por: userData.user.id,
    }])
    .select('id')
    .single();
  if (avErro) throw avErro;
  const avaliacaoId = avaliacao.id as string;

  if (dados.questoes.length > 0) {
    const { error: qErro } = await supabase
      .from('prova_questoes')
      .insert(dados.questoes.map((q) => ({ prova_id: avaliacaoId, question_id: q.question_id, ordem: q.ordem, valor: q.valor })));
    if (qErro) throw qErro;
  }

  if (dados.turmaIds.length > 0) {
    const { error: tErro } = await supabase
      .from('prova_turmas')
      .insert(dados.turmaIds.map((turmaId) => ({ prova_id: avaliacaoId, turma_id: turmaId })));
    if (tErro) throw tErro;
  }

  return avaliacaoId;
}

export async function atualizarStatusAvaliacao(id: string, status: StatusAvaliacao): Promise<void> {
  const { data, error } = await supabase.from('provas').update({ status }).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Não foi possível atualizar a avaliação. Verifique suas permissões.');
  }
}

export async function excluirAvaliacao(id: string): Promise<void> {
  const { error } = await supabase.from('provas').delete().eq('id', id);
  if (error) throw error;
}

export async function listarResultadosAvaliacao(avaliacaoId: string): Promise<ResultadoAluno[]> {
  const { data, error } = await supabase.rpc('rpc_resultados_avaliacao', { p_avaliacao_id: avaliacaoId });
  if (error) throw error;
  return (data ?? []) as ResultadoAluno[];
}

// ---- lado do aluno ----

export async function listarMinhasAvaliacoesAluno(): Promise<AvaliacaoAluno[]> {
  const { data, error } = await supabase.rpc('rpc_minhas_avaliacoes_aluno');
  if (error) throw error;
  return (data ?? []) as AvaliacaoAluno[];
}

export async function obterQuestoesAvaliacaoAluno(avaliacaoId: string): Promise<QuestaoParaAluno[]> {
  const { data, error } = await supabase.rpc('rpc_questoes_avaliacao_aluno', { p_avaliacao_id: avaliacaoId });
  if (error) throw error;
  return (data ?? []) as QuestaoParaAluno[];
}

export async function submeterRespostasAvaliacao(avaliacaoId: string, respostas: RespostaEnvio[]): Promise<ItemResultadoSubmissao[]> {
  const { data, error } = await supabase.rpc('rpc_submeter_resposta_avaliacao', {
    p_avaliacao_id: avaliacaoId,
    p_respostas: respostas,
  });
  if (error) throw error;
  return (data ?? []) as ItemResultadoSubmissao[];
}
