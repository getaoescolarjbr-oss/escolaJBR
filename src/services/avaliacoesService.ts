import { supabase } from '../lib/supabase';
import type {
  Avaliacao,
  AvaliacaoAluno,
  ItemPendenteCorrecao,
  ItemResultadoSubmissao,
  NovaAvaliacaoInput,
  QuestaoInfoRelatorio,
  QuestaoParaAluno,
  RelatorioAvaliacaoCompleto,
  RespostaEnvio,
  RespostaItemAluno,
  ResultadoAluno,
  ResultadoAlunoDetalhado,
  SimuladoPublicoIniciarResposta,
  SimuladoPublicoSubmeterResposta,
  StatusAvaliacao,
  AvaliacaoArea,
  NovaAvaliacaoAreaInput,
} from '../types/avaliacoes';
import { QUESTION_SELECT_FIELDS, type Question } from '../types/bancoQuestoes';

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

// Busca as questões já vinculadas à prova (com o objeto Question completo, pra reabrir o
// QuestionPicker/ConfigAvaliacaoForm já preenchidos ao editar) e o valor lançado por questão.
export async function obterQuestoesCompletasDaAvaliacao(id: string): Promise<{ questoes: Question[]; valoresPorQuestao: Record<string, number> }> {
  const { data, error } = await supabase
    .from('prova_questoes')
    .select(`ordem, valor, questions(${QUESTION_SELECT_FIELDS})`)
    .eq('prova_id', id)
    .order('ordem');
  if (error) throw error;

  const linhas = (data ?? []) as unknown as { ordem: number; valor: number; questions: Question | null }[];
  const questoes = linhas.map((l) => l.questions).filter((q): q is Question => !!q);
  const valoresPorQuestao: Record<string, number> = {};
  linhas.forEach((l) => {
    if (l.questions) valoresPorQuestao[l.questions.id] = Number(l.valor) || 0;
  });
  return { questoes, valoresPorQuestao };
}

// Quantos alunos já enviaram resposta pra esta avaliação/simulado — usado para avisar o
// professor antes de editar uma avaliação já publicada (mudar as questões depois que alguém
// respondeu pode invalidar o resultado já registrado).
export async function contarRespostasEnviadas(avaliacaoId: string): Promise<number> {
  const { count, error } = await supabase
    .from('prova_respostas')
    .select('id', { count: 'exact', head: true })
    .eq('prova_id', avaliacaoId)
    .not('finalizado_em', 'is', null);
  if (error) throw error;
  return count ?? 0;
}

// Edita uma avaliação já salva (rascunho ou publicada): atualiza os dados da prova e
// substitui por completo o vínculo de questões e de turmas. Não mexe em prova_respostas —
// respostas já enviadas continuam registradas, mas podem ficar "fora de sincronia" se as
// questões mudaram (por isso o aviso na tela antes de confirmar).
export async function atualizarAvaliacao(id: string, dados: NovaAvaliacaoInput, status: StatusAvaliacao): Promise<void> {
  const { error: avErro } = await supabase
    .from('provas')
    .update({
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
    })
    .eq('id', id);
  if (avErro) throw avErro;

  const { error: delQErro } = await supabase.from('prova_questoes').delete().eq('prova_id', id);
  if (delQErro) throw delQErro;
  if (dados.questoes.length > 0) {
    const { error: qErro } = await supabase
      .from('prova_questoes')
      .insert(dados.questoes.map((q) => ({ prova_id: id, question_id: q.question_id, ordem: q.ordem, valor: q.valor })));
    if (qErro) throw qErro;
  }

  const { error: delTErro } = await supabase.from('prova_turmas').delete().eq('prova_id', id);
  if (delTErro) throw delTErro;
  if (dados.turmaIds.length > 0) {
    const { error: tErro } = await supabase
      .from('prova_turmas')
      .insert(dados.turmaIds.map((turmaId) => ({ prova_id: id, turma_id: turmaId })));
    if (tErro) throw tErro;
  }

  if (status === 'PUBLICADA' && dados.tipo === 'AVALIACAO') {
    await sincronizarNotasDaProva(id, {
      titulo: dados.titulo,
      valorTotal: dados.valorTotal,
      dataAplicacao: dados.dataAplicacao,
      disciplinaId: dados.disciplinaId,
      bimestreId: dados.bimestreId,
      turmaIds: dados.turmaIds,
    });
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

export async function obterResultadosDetalhadosAvaliacao(avaliacaoId: string): Promise<RelatorioAvaliacaoCompleto> {
  // 1. Questões da avaliação ordenadas com gabarito
  const { data: questoesData, error: qErr } = await supabase
    .from('prova_questoes')
    .select('question_id, ordem, valor, questions(id, statement, correct_letter)')
    .eq('prova_id', avaliacaoId)
    .order('ordem');
  if (qErr) throw qErr;

  const questoes: QuestaoInfoRelatorio[] = (questoesData ?? []).map((row: Record<string, unknown>) => {
    const qObj = row.questions as { correct_letter?: string; statement?: string } | null;
    return {
      question_id: row.question_id as string,
      ordem: Number(row.ordem) || 0,
      valor: Number(row.valor) || 0,
      correct_letter: qObj?.correct_letter ?? '',
      statement: qObj?.statement ?? '',
    };
  });

  // 2. Turmas vinculadas
  const { data: turmasData } = await supabase
    .from('prova_turmas')
    .select('turma_id')
    .eq('prova_id', avaliacaoId);
  const turmaIds = (turmasData ?? []).map((t) => t.turma_id as string).filter(Boolean);

  // 3. Alunos das turmas
  let todosAlunos: { id: string; nome: string; codigo_sgde: string | null; turma_nome: string | null }[] = [];
  if (turmaIds.length > 0) {
    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome, codigo_sgde, turmas(nome)')
      .in('turma_id', turmaIds)
      .order('nome');
    todosAlunos = (alunosData ?? []).map((a: Record<string, unknown>) => {
      const tObj = a.turmas as { nome?: string } | null;
      return {
        id: a.id as string,
        nome: (a.nome as string) ?? '',
        codigo_sgde: (a.codigo_sgde as string) ?? null,
        turma_nome: tObj?.nome ?? null,
      };
    });
  }

  // 4. Respostas enviadas
  const { data: respostasData, error: rErr } = await supabase
    .from('prova_respostas')
    .select('id, aluno_id, nota, finalizado_em, alunos(id, nome, codigo_sgde, turmas(nome)), prova_respostas_itens(question_id, letra_marcada, correta, valor_obtido)')
    .eq('prova_id', avaliacaoId);
  if (rErr) throw rErr;

  const respostasMap = new Map<string, Record<string, unknown>>();
  for (const r of respostasData ?? []) {
    respostasMap.set(r.aluno_id as string, r as Record<string, unknown>);
  }

  const alunosResultados: ResultadoAlunoDetalhado[] = [];
  const alunosProcessados = new Set<string>();

  for (const al of todosAlunos) {
    alunosProcessados.add(al.id);
    const resp = respostasMap.get(al.id);
    const itens = (resp?.prova_respostas_itens as Record<string, unknown>[] | undefined) ?? [];
    const itensMap: Record<string, RespostaItemAluno> = {};
    let totalAcertos = 0;

    for (const item of itens) {
      const qId = item.question_id as string;
      const isCorreta = Boolean(item.correta);
      itensMap[qId] = {
        question_id: qId,
        letra_marcada: (item.letra_marcada as string) ?? null,
        correta: isCorreta,
        valor_obtido: Number(item.valor_obtido) || 0,
      };
      if (isCorreta) totalAcertos++;
    }

    alunosResultados.push({
      aluno_id: al.id,
      aluno_nome: al.nome,
      codigo_sgde: al.codigo_sgde,
      turma_nome: al.turma_nome,
      nota: resp?.finalizado_em ? Number(resp.nota) || 0 : null,
      finalizado_em: (resp?.finalizado_em as string) ?? null,
      respostas: itensMap,
      total_acertos: totalAcertos,
      total_questoes: questoes.length,
    });
  }

  for (const resp of respostasData ?? []) {
    const alunoId = resp.aluno_id as string;
    if (!alunosProcessados.has(alunoId)) {
      const alObj = resp.alunos as { nome?: string; codigo_sgde?: string | null; turmas?: { nome?: string } | null } | null;
      const itens = (resp.prova_respostas_itens as Record<string, unknown>[] | undefined) ?? [];
      const itensMap: Record<string, RespostaItemAluno> = {};
      let totalAcertos = 0;

      for (const item of itens) {
        const qId = item.question_id as string;
        const isCorreta = Boolean(item.correta);
        itensMap[qId] = {
          question_id: qId,
          letra_marcada: (item.letra_marcada as string) ?? null,
          correta: isCorreta,
          valor_obtido: Number(item.valor_obtido) || 0,
        };
        if (isCorreta) totalAcertos++;
      }

      alunosResultados.push({
        aluno_id: alunoId,
        aluno_nome: alObj?.nome ?? 'Aluno',
        codigo_sgde: alObj?.codigo_sgde ?? null,
        turma_nome: alObj?.turmas?.nome ?? null,
        nota: resp.finalizado_em ? Number(resp.nota) || 0 : null,
        finalizado_em: (resp.finalizado_em as string) ?? null,
        respostas: itensMap,
        total_acertos: totalAcertos,
        total_questoes: questoes.length,
      });
    }
  }

  return {
    questoes,
    alunos: alunosResultados,
  };
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

// ---- Correção manual (dissertativa/redação) ----

// Um item por resposta escrita de aluno nesta prova, com o que o professor precisa pra
// pontuar (enunciado, critérios, texto do aluno) e o que já foi corrigido.
export async function listarItensPendentesCorrecao(provaId: string): Promise<ItemPendenteCorrecao[]> {
  const { data, error } = await supabase.rpc('rpc_itens_pendentes_correcao', { p_prova_id: provaId });
  if (error) throw error;
  return (data ?? []) as ItemPendenteCorrecao[];
}

// Grava a nota e a observação de UM item escrito. A RPC também recalcula a nota da
// resposta e o status_correcao (vira CORRIGIDA quando não sobrar item pendente).
export async function corrigirItemDissertativo(itemId: string, valorObtido: number, observacao: string | null): Promise<void> {
  const { error } = await supabase.rpc('rpc_corrigir_item_dissertativo', {
    p_item_id: itemId,
    p_valor_obtido: valorObtido,
    p_observacao: observacao,
  });
  if (error) throw error;
}

// Ids das provas que têm pelo menos uma resposta aguardando correção manual — usado só
// pra decidir se o botão "Corrigir" aparece na lista de avaliações. Uma consulta só pra
// todas as provas, em vez de uma RPC por linha. Devolve conjunto vazio (sem estourar) se
// a coluna status_correcao ainda não existir no banco: a lista de avaliações não pode
// quebrar por causa de um botão opcional.
export async function obterProvasComCorrecaoPendente(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('prova_respostas')
    .select('prova_id')
    .eq('status_correcao', 'PENDENTE');
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.prova_id as string));
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

// ---- Avaliações Colaborativas de Área (PCA) ----

export async function criarAvaliacaoArea(dados: NovaAvaliacaoAreaInput): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_criar_avaliacao_area', {
    p_titulo: dados.titulo,
    p_area_conhecimento: dados.area_conhecimento,
    p_bimestre_id: dados.bimestre_id,
    p_valor_total: dados.valor_total,
    p_modo: dados.modo,
    p_tipo: dados.tipo,
    p_data_aplicacao: dados.data_aplicacao || null,
    p_prazo_entrega: dados.prazo_entrega || null,
    p_instrucoes: dados.instrucoes || null,
    p_turma_ids: dados.turma_ids,
    p_cotas: dados.cotas,
  });
  if (error) throw error;
  return data as string;
}

export async function listarAvaliacoesArea(areaConhecimento?: string): Promise<AvaliacaoArea[]> {
  const { data, error } = await supabase.rpc('rpc_listar_avaliacoes_area', {
    p_area_conhecimento: areaConhecimento || null,
  });
  if (error) throw error;
  return (data ?? []) as AvaliacaoArea[];
}

export async function inserirQuestoesCotaArea(
  provaId: string,
  disciplinaId: string,
  questoes: { question_id: string; valor: number }[]
): Promise<void> {
  const { error } = await supabase.rpc('rpc_inserir_questoes_cota_area', {
    p_prova_id: provaId,
    p_disciplina_id: disciplinaId,
    p_questoes: questoes,
  });
  if (error) throw error;
}

export async function publicarAvaliacaoArea(provaId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_publicar_avaliacao_area', {
    p_prova_id: provaId,
  });
  if (error) throw error;
}
