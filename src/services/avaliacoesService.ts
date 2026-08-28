import { supabase } from '../lib/supabase';
import type {
  Avaliacao,
  AvaliacaoAluno,
  ItemResultadoSubmissao,
  NovaAvaliacaoInput,
  QuestaoParaAluno,
  RespostaEnvio,
  ResultadoAluno,
  SimuladoPublicoIniciarResposta,
  SimuladoPublicoSubmeterResposta,
  StatusAvaliacao,
} from '../types/avaliacoes';

const AVALIACAO_SELECT = 'id, titulo, disciplina, disciplina_id, bimestre_id, instrucoes, valor_total, modo, tipo, token_publico, data_aplicacao, prazo_entrega, status, criado_por, created_at, updated_at';

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

export async function listarDisciplinasCatalogo(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from('disciplinas').select('id, nome').order('nome');
  if (error) throw error;
  return data ?? [];
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
      disciplina_id: dados.disciplinaId,
      bimestre_id: dados.bimestreId,
      instrucoes: dados.instrucoes || null,
      valor_total: dados.valorTotal,
      modo: dados.modo,
      tipo: dados.tipo,
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

  // Simulado nunca gera nota em "Notas e Avaliações" — ver create_simulados_publico.sql.
  if (status === 'PUBLICADA' && dados.tipo === 'AVALIACAO') {
    await sincronizarNotasDaProva(avaliacaoId, {
      titulo: dados.titulo,
      valorTotal: dados.valorTotal,
      dataAplicacao: dados.dataAplicacao,
      disciplinaId: dados.disciplinaId,
      bimestreId: dados.bimestreId,
      turmaIds: dados.turmaIds,
    });
  }

  return avaliacaoId;
}

// Cria, em "Notas e Avaliações" (avaliacoes/notas_avaliacoes — GradesPanel.tsx), uma
// avaliação de nota por turma da prova publicada, pra já aparecer o campo de nota
// pronto pro professor lançar. Idempotente (não duplica se a turma já foi
// sincronizada) e silenciosa se faltar disciplina/bimestre ou o autor não tiver um
// registro em `professores` (ex.: COORDENACAO/GESTAO sem vínculo de professor) — a
// prova em si já foi salva com sucesso, isso é só o vínculo com o boletim.
async function sincronizarNotasDaProva(
  provaId: string,
  dados: { titulo: string; valorTotal: number; dataAplicacao: string | null; disciplinaId: string | null; bimestreId: number | null; turmaIds: string[] }
): Promise<void> {
  if (!dados.disciplinaId || !dados.bimestreId || dados.turmaIds.length === 0) return;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const { data: prof } = await supabase.from('professores').select('id').eq('user_id', userData.user.id).maybeSingle();
  if (!prof) return;

  const { data: vinculosExistentes } = await supabase
    .from('prova_avaliacao_notas')
    .select('turma_id')
    .eq('prova_id', provaId);
  const turmasJaSincronizadas = new Set((vinculosExistentes ?? []).map((v) => v.turma_id as string));

  for (const turmaId of dados.turmaIds) {
    if (turmasJaSincronizadas.has(turmaId)) continue;

    const { data: notaAvaliacao, error: notaErro } = await supabase
      .from('avaliacoes')
      .insert({
        professor_id: prof.id,
        turma_id: turmaId,
        disciplina_id: dados.disciplinaId,
        bimestre_id: dados.bimestreId,
        nome: dados.titulo,
        valor_maximo: dados.valorTotal,
        data_avaliacao: dados.dataAplicacao,
        publicada: true,
      })
      .select('id')
      .single();
    if (notaErro || !notaAvaliacao) continue;

    await supabase.from('prova_avaliacao_notas').insert({ prova_id: provaId, turma_id: turmaId, avaliacao_id: notaAvaliacao.id });
  }
}

export async function atualizarStatusAvaliacao(id: string, status: StatusAvaliacao): Promise<void> {
  const { data, error } = await supabase.from('provas').update({ status }).eq('id', id).select('id, titulo, valor_total, data_aplicacao, disciplina_id, bimestre_id, tipo');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Não foi possível atualizar a avaliação. Verifique suas permissões.');
  }

  const prova = data[0] as { id: string; titulo: string; valor_total: number; data_aplicacao: string | null; disciplina_id: string | null; bimestre_id: number | null; tipo: 'AVALIACAO' | 'SIMULADO' };
  if (status === 'PUBLICADA' && prova.tipo === 'AVALIACAO') {
    const { data: turmas } = await supabase.from('prova_turmas').select('turma_id').eq('prova_id', id);
    await sincronizarNotasDaProva(id, {
      titulo: prova.titulo,
      valorTotal: prova.valor_total,
      dataAplicacao: prova.data_aplicacao,
      disciplinaId: prova.disciplina_id,
      bimestreId: prova.bimestre_id,
      turmaIds: (turmas ?? []).map((t) => t.turma_id as string),
    });
  }
}

// Exclui a prova e, se ela já tiver avaliação(ões) de nota vinculada(s) (ver
// sincronizarNotasDaProva), apaga também as notas lançadas e a avaliação em "Notas e
// Avaliações" — pra nunca sobrar um boletim com uma coluna de nota "órfã" de uma prova
// que não existe mais. A confirmação (com o aviso sobre isso) fica na tela que chama
// esta função (MinhasAvaliacoesTab.tsx).
export async function excluirAvaliacao(id: string): Promise<void> {
  const { data: vinculos } = await supabase.from('prova_avaliacao_notas').select('avaliacao_id').eq('prova_id', id);
  const notasIds = (vinculos ?? []).map((v) => v.avaliacao_id as string);

  if (notasIds.length > 0) {
    await supabase.from('notas_avaliacoes').delete().in('avaliacao_id', notasIds);
    await supabase.from('avaliacoes').delete().in('id', notasIds);
  }

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

// Mesmo payload da função acima, mas para quem criou a avaliação (ou coordenação/
// gestão) conferir como ela chega ao aluno. Também não traz correct_letter — ver
// add_avaliacao_preview_professor.sql.
export async function obterQuestoesAvaliacaoPreview(avaliacaoId: string): Promise<QuestaoParaAluno[]> {
  const { data, error } = await supabase.rpc('rpc_questoes_avaliacao_preview', { p_avaliacao_id: avaliacaoId });
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

// ---- Simulado público (sem login — ver create_simulados_publico.sql) ----

export function linkPublicoSimulado(tokenPublico: string): string {
  return `${window.location.origin}/?simulado=${tokenPublico}`;
}

export async function iniciarSimuladoPublico(token: string, codigoSgde: string): Promise<SimuladoPublicoIniciarResposta> {
  const { data, error } = await supabase.rpc('rpc_simulado_publico_iniciar', { p_token: token, p_codigo_sgde: codigoSgde.trim() });
  if (error) throw error;
  return data as SimuladoPublicoIniciarResposta;
}

export async function submeterSimuladoPublico(token: string, codigoSgde: string, respostas: RespostaEnvio[]): Promise<SimuladoPublicoSubmeterResposta> {
  const { data, error } = await supabase.rpc('rpc_simulado_publico_submeter', {
    p_token: token,
    p_codigo_sgde: codigoSgde.trim(),
    p_respostas: respostas,
  });
  if (error) throw error;
  return data as SimuladoPublicoSubmeterResposta;
}
