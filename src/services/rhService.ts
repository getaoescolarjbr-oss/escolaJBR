import { supabase } from '../lib/supabase';
import { logAcesso } from './auditoriaService';
import type { JornadaServidor, FrequenciaServidor, Terceirizado, StatusFrequencia, AusenciaServidor, Substituicao } from '../types/rh';

// --- Escala / jornada ---
export async function listarJornadas(): Promise<JornadaServidor[]> {
  const { data, error } = await supabase.from('jornada_servidor').select('*').order('vigencia_inicio', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarJornada(dados: Omit<JornadaServidor, 'id' | 'criado_em'>): Promise<JornadaServidor> {
  const { data, error } = await supabase.from('jornada_servidor').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function excluirJornada(id: string): Promise<void> {
  const { error } = await supabase.from('jornada_servidor').delete().eq('id', id);
  if (error) throw error;
}

// --- Terceirizados ---
export async function listarTerceirizados(): Promise<Terceirizado[]> {
  const { data, error } = await supabase.from('terceirizados').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function criarTerceirizado(dados: Omit<Terceirizado, 'id' | 'criado_em'>): Promise<Terceirizado> {
  const { data, error } = await supabase.from('terceirizados').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarTerceirizado(id: string, dados: Partial<Terceirizado>): Promise<void> {
  const { error } = await supabase.from('terceirizados').update(dados).eq('id', id);
  if (error) throw error;
}

// --- Frequência diária (ponto interno) ---
export async function listarFrequenciaDoDia(data: string): Promise<FrequenciaServidor[]> {
  const { data: rows, error } = await supabase.from('frequencia_servidor').select('*').eq('data', data);
  if (error) throw error;
  return rows ?? [];
}

// Upsert via RPC: os índices únicos de frequencia_servidor são parciais (servidor_id/
// terceirizado_id são nuláveis), e o upsert do supabase-js não gera o predicado WHERE
// necessário pra casar com um índice parcial — ver rpc_registrar_frequencia_servidor.
export async function registrarFrequenciaServidor(
  servidorId: string,
  data: string,
  status: StatusFrequencia,
  justificativa?: string
): Promise<void> {
  const { error } = await supabase.rpc('rpc_registrar_frequencia_servidor', {
    p_vinculo: 'SERVIDOR',
    p_servidor_id: servidorId,
    p_terceirizado_id: null,
    p_data: data,
    p_status: status,
    p_justificativa: justificativa || null,
  });
  if (error) throw error;
}

export async function registrarFrequenciaTerceirizado(
  terceirizadoId: string,
  data: string,
  status: StatusFrequencia,
  justificativa?: string
): Promise<void> {
  const { error } = await supabase.rpc('rpc_registrar_frequencia_servidor', {
    p_vinculo: 'TERCEIRIZADO',
    p_servidor_id: null,
    p_terceirizado_id: terceirizadoId,
    p_data: data,
    p_status: status,
    p_justificativa: justificativa || null,
  });
  if (error) throw error;
}

// --- Ausências / atestados / licenças (tabela atestados_servidores, retrofitada) ---
// Dado sensível de saúde: RLS já restringe a GESTAO/SECRETARIA + o próprio titular
// (ver create_gestao_rh_schema.sql). Não expor em telas de uso geral.
export async function listarAusencias(): Promise<AusenciaServidor[]> {
  const { data, error } = await supabase.from('atestados_servidores').select('*').order('data_inicio', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarAusencia(dados: {
  professor_id: string;
  tipo: AusenciaServidor['tipo'];
  data_inicio: string;
  data_fim: string;
  substituto_id: string | null;
  bloquear_titular?: boolean;
  processo_sed_ref: string | null;
  observacoes: string | null;
}): Promise<AusenciaServidor> {
  // O bloqueio só existe com substituto (senão ninguém assumiria as turmas).
  const bloquear = !!dados.substituto_id && !!dados.bloquear_titular;
  const { data, error } = await supabase
    .from('atestados_servidores')
    .insert([{ ...dados, bloquear_titular: bloquear, ativo: true, status_oficial: 'INTERNO' }])
    .select()
    .single();
  if (error) throw error;
  if (data.substituto_id) {
    try {
      await criarEspelhosDaAusencia(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'erro desconhecido';
      throw new Error(`A ausência foi registrada, mas não foi possível espelhar as turmas para o substituto: ${msg}`, { cause: e });
    }
  }
  return data;
}

// Espelha as turmas (alocações) do servidor ausente para o substituto — mesma regra do cadastro
// de atestado em Cadastro de Pessoas (AtestadoModal): copia só as alocações próprias, marcadas
// com o atestado de origem para poderem ser removidas ao encerrar.
export async function criarEspelhosDaAusencia(ausencia: Pick<AusenciaServidor, 'id' | 'professor_id' | 'substituto_id'>): Promise<number> {
  if (!ausencia.substituto_id) return 0;
  const { data: originais, error } = await supabase
    .from('alocacoes_v2')
    .select('turma_id, disciplina_id')
    .eq('professor_id', ausencia.professor_id)
    .eq('is_espelho', false);
  if (error) throw error;
  if (!originais || originais.length === 0) return 0;
  const { error: erroInsert } = await supabase.from('alocacoes_v2').insert(
    originais.map((a) => ({
      professor_id: ausencia.substituto_id,
      turma_id: a.turma_id,
      disciplina_id: a.disciplina_id,
      is_espelho: true,
      atestado_id: ausencia.id,
      professor_original_id: ausencia.professor_id,
    }))
  );
  if (erroInsert) throw erroInsert;
  return originais.length;
}

export async function removerEspelhosDaAusencia(ausenciaId: string): Promise<void> {
  const { error } = await supabase.from('alocacoes_v2').delete().eq('atestado_id', ausenciaId).eq('is_espelho', true);
  if (error) throw error;
}

// Liga/desliga o bloqueio do titular numa ausência já registrada (só faz sentido com substituto).
export async function definirBloqueioTitular(id: string, bloquear: boolean): Promise<void> {
  const { error } = await supabase.from('atestados_servidores').update({ bloquear_titular: bloquear }).eq('id', id);
  if (error) throw error;
}

// status_oficial é sempre um rótulo escolhido manualmente por GESTAO/SECRETARIA — o
// app nunca "defere" nada sozinho (ver moldura em create_gestao_rh_schema.sql).
export async function atualizarStatusOficialAusencia(id: string, statusOficial: AusenciaServidor['status_oficial'], processoSedRef: string | null): Promise<void> {
  const { error } = await supabase.from('atestados_servidores').update({ status_oficial: statusOficial, processo_sed_ref: processoSedRef }).eq('id', id);
  if (error) throw error;
}

export async function encerrarAusencia(id: string, dataFim: string): Promise<void> {
  const { error } = await supabase.from('atestados_servidores').update({ ativo: false, data_fim: dataFim }).eq('id', id);
  if (error) throw error;
  // Encerrou: o titular retoma as turmas, então os espelhos do substituto saem (igual ao AtestadoModal).
  await removerEspelhosDaAusencia(id);
}

const BUCKET_RH_DOCUMENTOS = 'rh-documentos';

export async function enviarDocumentoAusencia(ausenciaId: string, arquivo: File): Promise<void> {
  const path = `ausencias/${ausenciaId}/${Date.now()}-${arquivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_RH_DOCUMENTOS).upload(path, arquivo, { upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from('atestados_servidores').update({ documento_path: path }).eq('id', ausenciaId);
  if (error) throw error;
}

// Cada geração de link é uma leitura de dado sensível — registrada em auditoria
// (best-effort, mesmo padrão de documentosPessoaService/cozinhaService).
export async function obterUrlDocumentoAusencia(ausencia: AusenciaServidor): Promise<string> {
  if (!ausencia.documento_path) throw new Error('Nenhum documento anexado.');
  const { data, error } = await supabase.storage.from(BUCKET_RH_DOCUMENTOS).createSignedUrl(ausencia.documento_path, 60);
  if (error) throw error;
  await logAcesso('atestados_servidores', ausencia.id, null, 'READ');
  return data.signedUrl;
}

// --- Substituições (arranjo informal de cobertura — não formaliza nada perante a SED) ---
export async function listarSubstituicoes(data?: string): Promise<Substituicao[]> {
  let query = supabase.from('substituicoes').select('*').order('data', { ascending: false });
  if (data) query = query.eq('data', data);
  const { data: rows, error } = await query;
  if (error) throw error;
  return rows ?? [];
}

export async function criarSubstituicao(dados: {
  servidor_ausente_id: string;
  substituto_id: string | null;
  turma_id: string | null;
  aula_ref: string | null;
  data: string;
  observacoes: string | null;
  registrado_por: string;
}): Promise<Substituicao> {
  const { data, error } = await supabase.from('substituicoes').insert([{ ...dados, status: 'ARRANJO_INTERNO' }]).select().single();
  if (error) throw error;
  return data;
}

export async function atribuirSubstituto(id: string, substitutoId: string): Promise<void> {
  const { error } = await supabase.from('substituicoes').update({ substituto_id: substitutoId }).eq('id', id);
  if (error) throw error;
}

// status é só um rótulo manual — FORMALIZADA_SED não confere nenhum acesso real
// (diferente do espelhamento de atestados_servidores/alocacoes_v2).
export async function marcarSubstituicaoFormalizada(id: string, formalizada: boolean): Promise<void> {
  const { error } = await supabase.from('substituicoes').update({ status: formalizada ? 'FORMALIZADA_SED' : 'ARRANJO_INTERNO' }).eq('id', id);
  if (error) throw error;
}
