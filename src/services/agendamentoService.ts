import { supabase } from '../lib/supabase';
import type {
  Recurso,
  BloqueioRecurso,
  DisponibilidadeSlot,
  Reserva,
  StatusReserva,
  RelatorioAgendamento,
  SerieReserva,
  OcorrenciaSerieResultado,
  CampoPersonalizado,
  ReservaValorPersonalizado,
  ReservaCompartilhamento,
  DashboardDiaLinha,
  ValidacaoLinhaRecurso,
  ImportacaoLinhaRecurso,
  ValidacaoLinhaSerie,
  ImportacaoLinhaSerie,
} from '../types/agendamento';

export interface ReservaComRecurso extends Reserva {
  recurso_nome?: string;
  turma_nome?: string;
  professor_nome?: string;
}

// --- Recursos ---
export async function listarRecursos(): Promise<Recurso[]> {
  const { data, error } = await supabase.from('recursos').select('*').order('ordem');
  if (error) throw error;
  return data ?? [];
}

export async function criarRecurso(dados: Omit<Recurso, 'id' | 'criado_em'>): Promise<Recurso> {
  const { data, error } = await supabase.from('recursos').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarRecurso(id: string, dados: Partial<Recurso>): Promise<void> {
  const { error } = await supabase.from('recursos').update(dados).eq('id', id);
  if (error) throw error;
}

export async function excluirRecurso(id: string): Promise<void> {
  const { error } = await supabase.from('recursos').delete().eq('id', id);
  if (error) throw error;
}

// --- Bloqueios de manutenção ---
export async function listarBloqueios(recursoId?: string): Promise<BloqueioRecurso[]> {
  let query = supabase.from('bloqueios_recurso').select('*').order('data_inicio', { ascending: false });
  if (recursoId) query = query.eq('recurso_id', recursoId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function criarBloqueio(dados: {
  recurso_id: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
  criado_por: string;
}): Promise<BloqueioRecurso> {
  const { data, error } = await supabase.from('bloqueios_recurso').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function removerBloqueio(id: string): Promise<void> {
  const { error } = await supabase.from('bloqueios_recurso').delete().eq('id', id);
  if (error) throw error;
}

// --- Disponibilidade pública (RPC, funciona sem login) ---
export async function obterDisponibilidade(recursoId: string, dataInicio: string, dataFim: string): Promise<DisponibilidadeSlot[]> {
  const { data, error } = await supabase.rpc('get_disponibilidade', {
    p_recurso_id: recursoId,
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
  });
  if (error) throw error;
  return (data ?? []) as DisponibilidadeSlot[];
}

// --- Reservas ---

// professor_id do usuário logado (professores.user_id = auth.uid()) — é o que a RLS
// de INSERT em `reservas` exige para quem só tem papel PROFESSOR.
export async function obterMeuProfessorId(usuarioId: string): Promise<string | null> {
  const { data, error } = await supabase.from('professores').select('id').eq('user_id', usuarioId).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function listarProfessoresParaSelecao(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from('professores').select('id, nome').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function listarTurmas(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from('turmas').select('id, nome').order('nome');
  if (error) throw error;
  return data ?? [];
}

// Turmas de uma série específica — usado no cadastro do BiblioClube (série filtra turma,
// ver create_avaliacoes_schema.sql que adiciona turmas.serie_id).
export async function listarTurmasPorSerie(serieId: string): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from('turmas').select('id, nome').eq('serie_id', serieId).order('nome');
  if (error) throw error;
  return data ?? [];
}

// Traduz o erro de conflito (constraint de exclusão OU trigger de bloqueio de
// manutenção, ambos usam o código 23P01) para uma mensagem que a tela pode mostrar
// sem quebrar. Qualquer outro erro é repassado como está.
export function traduzirErroReserva(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === '23P01') {
    return 'Este horário já está reservado ou o recurso está indisponível nessa data. Escolha outro horário.';
  }
  return err instanceof Error ? err.message : 'Erro ao processar a reserva.';
}

export async function criarReserva(dados: {
  recurso_id: string;
  professor_id: string;
  turma_id: string | null;
  finalidade: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: 'CONFIRMADA' | 'PENDENTE';
  criado_por: string;
  tema?: string | null;
  objetivos?: string | null;
}): Promise<Reserva> {
  const { data, error } = await supabase.from('reservas').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function listarMinhasReservas(professorId: string): Promise<ReservaComRecurso[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, recursos(nome), turmas(nome)')
    .eq('professor_id', professorId)
    .order('data', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    recurso_nome: (r as unknown as { recursos: { nome: string } | null }).recursos?.nome,
    turma_nome: (r as unknown as { turmas: { nome: string } | null }).turmas?.nome,
  }));
}

// "Aulas recentes para reserva rápida": não precisa de tabela nova — só as últimas
// reservas distintas (por recurso+turma+finalidade) do próprio professor, mais
// recentes primeiro, pra oferecer um atalho de "repetir".
export async function listarReservasRecentesParaRepetir(professorId: string, limite = 8): Promise<ReservaComRecurso[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, recursos(nome), turmas(nome)')
    .eq('professor_id', professorId)
    .neq('status', 'CANCELADA')
    .order('criado_em', { ascending: false })
    .limit(30);
  if (error) throw error;
  const linhas = (data ?? []).map((r) => ({
    ...r,
    recurso_nome: (r as unknown as { recursos: { nome: string } | null }).recursos?.nome,
    turma_nome: (r as unknown as { turmas: { nome: string } | null }).turmas?.nome,
  }));
  // Dedup por combinação recurso+turma+horário — evita mostrar 5x "a mesma aula"
  // quando o professor reserva o mesmo horário toda semana.
  const vistos = new Set<string>();
  const distintas: ReservaComRecurso[] = [];
  for (const r of linhas) {
    const chave = `${r.recurso_id}|${r.turma_id ?? ''}|${r.hora_inicio}|${r.hora_fim}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    distintas.push(r);
    if (distintas.length >= limite) break;
  }
  return distintas;
}

// --- Agenda da turma em tempo real (Supabase Realtime já habilitado em `reservas`) ---
export async function listarReservasDaTurma(turmaId: string, dataInicio: string, dataFim: string): Promise<ReservaComRecurso[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, recursos(nome), professores(nome)')
    .eq('turma_id', turmaId)
    .in('status', ['CONFIRMADA', 'PENDENTE'])
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data')
    .order('hora_inicio');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    recurso_nome: (r as unknown as { recursos: { nome: string } | null }).recursos?.nome,
    professor_nome: (r as unknown as { professores: { nome: string } | null }).professores?.nome,
  }));
}

export async function cancelarReserva(id: string): Promise<void> {
  const { error } = await supabase.from('reservas').update({ status: 'CANCELADA' }).eq('id', id);
  if (error) throw error;
}

// user_id (auth.users.id) do professor dono de uma reserva — usado para notificar
// via sendPushToUsers (reutilizado, ver services/pushService.ts).
export async function obterUserIdDoProfessor(professorId: string): Promise<string | null> {
  const { data, error } = await supabase.from('professores').select('user_id').eq('id', professorId).maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

// --- Visão de Coordenação/Gestão: todas as reservas + fila de aprovação ---
export async function listarTodasReservas(filtroStatus?: StatusReserva): Promise<ReservaComRecurso[]> {
  let query = supabase
    .from('reservas')
    .select('*, recursos(nome), turmas(nome), professores(nome)')
    .order('data', { ascending: false });
  if (filtroStatus) query = query.eq('status', filtroStatus);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    recurso_nome: (r as unknown as { recursos: { nome: string } | null }).recursos?.nome,
    turma_nome: (r as unknown as { turmas: { nome: string } | null }).turmas?.nome,
    professor_nome: (r as unknown as { professores: { nome: string } | null }).professores?.nome,
  }));
}

// Aprova (CONFIRMADA) ou recusa (RECUSADA) uma reserva PENDENTE via RPC — só
// COORDENACAO/GESTAO (checado no banco); a RPC também grava aprovado_por/aprovado_em.
export async function decidirReserva(id: string, aprovar: boolean): Promise<Reserva> {
  const { data, error } = await supabase.rpc('rpc_decidir_reserva', { p_reserva_id: id, p_aprovar: aprovar });
  if (error) throw error;
  return data as Reserva;
}

// --- Relatórios (Coordenação/Gestão) ---
export async function obterRelatorioAgendamento(dataInicio: string, dataFim: string): Promise<RelatorioAgendamento> {
  const { data, error } = await supabase.rpc('rpc_relatorio_agendamento', { p_data_inicio: dataInicio, p_data_fim: dataFim });
  if (error) throw error;
  return data as RelatorioAgendamento;
}

// --- Dashboard do dia (Coordenação/Gestão) ---
// Tenta a RPC; se não existir (42883) ou falhar, faz fallback com query direta.
export async function obterDashboardDia(data: string): Promise<DashboardDiaLinha[]> {
  const { data: linhas, error } = await supabase.rpc('rpc_dashboard_dia', { p_data: data });
  if (!error) return (linhas ?? []) as DashboardDiaLinha[];

  // Fallback: busca recursos ativos + reservas do dia diretamente das tabelas
  const { data: recursos, error: errRecursos } = await supabase
    .from('recursos')
    .select('id, nome')
    .eq('ativo', true)
    .order('ordem');
  if (errRecursos) throw errRecursos;

  const { data: reservas, error: errReservas } = await supabase
    .from('reservas')
    .select('id, recurso_id, hora_inicio, hora_fim, status, finalidade, tema, turmas(nome), profiles(nome_completo)')
    .eq('data', data)
    .not('status', 'eq', 'CANCELADA');
  if (errReservas) throw errReservas;

  // Monta linhas no mesmo formato que a RPC retornaria
  const resultado: DashboardDiaLinha[] = [];
  for (const r of recursos ?? []) {
    const reservasDoRecurso = (reservas ?? []).filter((rv) => rv.recurso_id === r.id);
    if (reservasDoRecurso.length === 0) {
      // Recurso livre no dia — linha sem reserva
      resultado.push({ recurso_id: r.id, recurso_nome: r.nome, reserva_id: null, hora_inicio: null, hora_fim: null, status: null, professor_nome: null, turma_nome: null, finalidade: null, tema: null });
    } else {
      for (const rv of reservasDoRecurso) {
        const raw = rv as unknown as { turmas: { nome: string } | null; profiles: { nome_completo: string } | null };
        resultado.push({
          recurso_id: r.id,
          recurso_nome: r.nome,
          reserva_id: rv.id,
          hora_inicio: rv.hora_inicio,
          hora_fim: rv.hora_fim,
          status: rv.status as StatusReserva,
          professor_nome: raw.profiles?.nome_completo ?? null,
          turma_nome: raw.turmas?.nome ?? null,
          finalidade: rv.finalidade ?? null,
          tema: rv.tema ?? null,
        });
      }
    }
  }
  return resultado;
}

// --- Aulas fixas recorrentes (séries) ---
// Mesmo motor/checagem de conflito atômica da reserva avulsa: cada ocorrência é
// tentada individualmente no servidor; um conflito numa data não derruba as demais.
export async function listarSeries(): Promise<SerieReserva[]> {
  const { data, error } = await supabase.from('reservas_serie').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarSerieRecorrente(dados: {
  recurso_id: string;
  professor_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  turma_id: string | null;
  finalidade: string | null;
}): Promise<OcorrenciaSerieResultado[]> {
  const { data, error } = await supabase.rpc('rpc_criar_serie_recorrente', {
    p_recurso_id: dados.recurso_id,
    p_professor_id: dados.professor_id,
    p_dia_semana: dados.dia_semana,
    p_hora_inicio: dados.hora_inicio,
    p_hora_fim: dados.hora_fim,
    p_vigencia_inicio: dados.vigencia_inicio,
    p_vigencia_fim: dados.vigencia_fim,
    p_turma_id: dados.turma_id,
    p_finalidade: dados.finalidade,
  });
  if (error) throw error;
  return (data ?? []) as OcorrenciaSerieResultado[];
}

// Cancela a série e as ocorrências futuras ainda pendentes/confirmadas; o histórico
// passado nunca é tocado (RPC, ver create_agendamento_etapa1_schema.sql).
export async function cancelarSerie(serieId: string, aPartirDe?: string): Promise<number> {
  const { data, error } = await supabase.rpc('rpc_cancelar_serie', { p_serie_id: serieId, p_a_partir_de: aPartirDe ?? new Date().toISOString().slice(0, 10) });
  if (error) throw error;
  return data as number;
}

export async function listarOcorrenciasSerie(serieId: string): Promise<ReservaComRecurso[]> {
  const { data, error } = await supabase.from('reservas').select('*, recursos(nome), turmas(nome)').eq('serie_id', serieId).order('data');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    recurso_nome: (r as unknown as { recursos: { nome: string } | null }).recursos?.nome,
    turma_nome: (r as unknown as { turmas: { nome: string } | null }).turmas?.nome,
  }));
}

// --- Campos personalizados (por agenda) ---
export async function listarCamposPersonalizados(): Promise<CampoPersonalizado[]> {
  const { data, error } = await supabase.from('campos_personalizados').select('*').order('ordem');
  if (error) throw error;
  return data ?? [];
}

export async function criarCampoPersonalizado(dados: Omit<CampoPersonalizado, 'id' | 'criado_em'>): Promise<CampoPersonalizado> {
  const { data, error } = await supabase.from('campos_personalizados').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarCampoPersonalizado(id: string, dados: Partial<CampoPersonalizado>): Promise<void> {
  const { error } = await supabase.from('campos_personalizados').update(dados).eq('id', id);
  if (error) throw error;
}

export async function listarValoresPersonalizados(reservaId: string): Promise<ReservaValorPersonalizado[]> {
  const { data, error } = await supabase.from('reserva_valores_personalizados').select('*').eq('reserva_id', reservaId);
  if (error) throw error;
  return data ?? [];
}

export async function salvarValorPersonalizado(reservaId: string, campoId: string, valor: string): Promise<void> {
  const { error } = await supabase.from('reserva_valores_personalizados').upsert([{ reserva_id: reservaId, campo_id: campoId, valor }], { onConflict: 'reserva_id,campo_id' });
  if (error) throw error;
}

// --- Compartilhamento de reserva (destinatário específico — entrega via pushService
// já existente, sem segundo sistema de notificação) ---
export async function compartilharReserva(reservaId: string, usuarioDestinoId: string, compartilhadoPor: string): Promise<void> {
  const { error } = await supabase.from('reserva_compartilhamentos').insert([{ reserva_id: reservaId, compartilhado_com_usuario_id: usuarioDestinoId, compartilhado_por: compartilhadoPor }]);
  if (error) throw error;
}

export async function listarCompartilhamentos(reservaId: string): Promise<ReservaCompartilhamento[]> {
  const { data, error } = await supabase.from('reserva_compartilhamentos').select('*').eq('reserva_id', reservaId);
  if (error) throw error;
  return data ?? [];
}

export async function removerCompartilhamento(id: string): Promise<void> {
  const { error } = await supabase.from('reserva_compartilhamentos').delete().eq('id', id);
  if (error) throw error;
}

// --- Importação CSV: recursos ---
// "Nunca importar direto sem validar": o dry-run é só leitura; a importação real
// roda a MESMA validação no servidor antes de cada INSERT (não confia no dry-run
// do cliente), então uma linha inválida nunca é gravada mesmo pulando a
// pré-visualização.
export async function dryRunImportacaoRecursos(linhas: Record<string, unknown>[]): Promise<ValidacaoLinhaRecurso[]> {
  const { data, error } = await supabase.rpc('rpc_dry_run_importacao_recursos', { p_linhas: linhas });
  if (error) throw error;
  return (data ?? []) as ValidacaoLinhaRecurso[];
}

export async function importarRecursos(linhas: Record<string, unknown>[]): Promise<ImportacaoLinhaRecurso[]> {
  const { data, error } = await supabase.rpc('rpc_importar_recursos', { p_linhas: linhas });
  if (error) throw error;
  return (data ?? []) as ImportacaoLinhaRecurso[];
}

// --- Importação CSV: aulas fixas (séries) ---
// Resolve recurso/professor/turma por nome (mais prático em planilha que UUID); o
// dry-run simula o conflito em modo leitura (mesma regra da EXCLUDE) sem gravar
// nada; a importação real chama rpc_criar_serie_recorrente linha a linha — mesmo
// motor e mesma checagem atômica da Etapa 1.
export async function dryRunImportacaoSeries(linhas: Record<string, unknown>[]): Promise<ValidacaoLinhaSerie[]> {
  const { data, error } = await supabase.rpc('rpc_dry_run_importacao_series', { p_linhas: linhas });
  if (error) throw error;
  return (data ?? []) as ValidacaoLinhaSerie[];
}

export async function importarSeries(linhas: Record<string, unknown>[]): Promise<ImportacaoLinhaSerie[]> {
  const { data, error } = await supabase.rpc('rpc_importar_series', { p_linhas: linhas });
  if (error) throw error;
  return (data ?? []) as ImportacaoLinhaSerie[];
}
