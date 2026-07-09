import { supabase } from '../lib/supabase';
import { sendPushToUsers } from './pushService';
import type { OrgaoColegiado, MembroColegiado, ReuniaoColegiado, ReuniaoPresenca, Deliberacao, AtaColegiado, Comunicado } from '../types/governanca';

// --- Órgãos colegiados ---
export async function listarOrgaos(): Promise<OrgaoColegiado[]> {
  const { data, error } = await supabase.from('orgaos_colegiados').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function criarOrgao(dados: {
  tipo: OrgaoColegiado['tipo'];
  nome: string;
  mandato_inicio: string | null;
  mandato_fim: string | null;
  cnpj: string | null;
}): Promise<OrgaoColegiado> {
  const { data, error } = await supabase.from('orgaos_colegiados').insert([{ ...dados, ativo: true }]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarOrgao(id: string, dados: Partial<OrgaoColegiado>): Promise<void> {
  const { error } = await supabase.from('orgaos_colegiados').update(dados).eq('id', id);
  if (error) throw error;
}

const BUCKET_GOVERNANCA_DOCUMENTOS = 'governanca-documentos';

export async function enviarEstatuto(orgaoId: string, arquivo: File): Promise<void> {
  const path = `estatutos/${orgaoId}/${Date.now()}-${arquivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_GOVERNANCA_DOCUMENTOS).upload(path, arquivo, { upsert: false });
  if (uploadError) throw uploadError;
  await atualizarOrgao(orgaoId, { estatuto_doc_path: path });
}

export async function obterUrlEstatuto(orgao: OrgaoColegiado): Promise<string> {
  if (!orgao.estatuto_doc_path) throw new Error('Nenhum estatuto anexado.');
  const { data, error } = await supabase.storage.from(BUCKET_GOVERNANCA_DOCUMENTOS).createSignedUrl(orgao.estatuto_doc_path, 60);
  if (error) throw error;
  return data.signedUrl;
}

// --- Membros / mandatos ---
export async function listarMembros(orgaoId: string): Promise<MembroColegiado[]> {
  const { data, error } = await supabase.from('membros_colegiado').select('*').eq('orgao_id', orgaoId).order('mandato_fim');
  if (error) throw error;
  return data ?? [];
}

export async function criarMembro(dados: Omit<MembroColegiado, 'id' | 'criado_em'>): Promise<MembroColegiado> {
  const { data, error } = await supabase.from('membros_colegiado').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function excluirMembro(id: string): Promise<void> {
  const { error } = await supabase.from('membros_colegiado').delete().eq('id', id);
  if (error) throw error;
}

// pessoas tem SELECT restrito a GESTAO/SECRETARIA — COORDENACAO (que também acessa
// este painel) não leria nome de membro diretamente. RPC mínima (só id+nome),
// escopada aos membros de UM órgão, não uma busca geral de pessoas.
export async function obterNomesMembros(orgaoId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('rpc_nomes_membros_colegiado', { p_orgao_id: orgaoId });
  if (error) throw error;
  const mapa: Record<string, string> = {};
  for (const row of (data ?? []) as { pessoa_id: string; nome: string }[]) mapa[row.pessoa_id] = row.nome;
  return mapa;
}

// --- Reuniões ---
export async function listarReunioes(orgaoId: string): Promise<ReuniaoColegiado[]> {
  const { data, error } = await supabase.from('reunioes_colegiado').select('*').eq('orgao_id', orgaoId).order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarReuniao(dados: {
  orgao_id: string;
  tipo: ReuniaoColegiado['tipo'];
  data: string;
  pauta: string | null;
  criado_por: string;
}): Promise<ReuniaoColegiado> {
  const { data, error } = await supabase.from('reunioes_colegiado').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function marcarReuniaoRealizada(id: string): Promise<void> {
  const { error } = await supabase.from('reunioes_colegiado').update({ status: 'REALIZADA' }).eq('id', id);
  if (error) throw error;
}

// --- Presença ---
export async function listarPresencas(reuniaoId: string): Promise<ReuniaoPresenca[]> {
  const { data, error } = await supabase.from('reuniao_presenca').select('*').eq('reuniao_id', reuniaoId);
  if (error) throw error;
  return data ?? [];
}

export async function marcarPresenca(reuniaoId: string, membroId: string, presente: boolean): Promise<void> {
  const { error } = await supabase
    .from('reuniao_presenca')
    .upsert([{ reuniao_id: reuniaoId, membro_id: membroId, presente }], { onConflict: 'reuniao_id,membro_id' });
  if (error) throw error;
}

// --- Deliberações ---
export async function listarDeliberacoes(reuniaoId: string): Promise<Deliberacao[]> {
  const { data, error } = await supabase.from('deliberacoes').select('*').eq('reuniao_id', reuniaoId).order('criado_em');
  if (error) throw error;
  return data ?? [];
}

export async function criarDeliberacao(reuniaoId: string, descricao: string, resultado: string | null): Promise<Deliberacao> {
  const { data, error } = await supabase.from('deliberacoes').insert([{ reuniao_id: reuniaoId, descricao, resultado }]).select().single();
  if (error) throw error;
  return data;
}

// --- Ata (motor da Fase 5a — mesma numeração/auditoria de rpc_emitir_ata, série
// própria ATA_COLEGIADO, ver create_gestao_governanca_schema.sql) ---
export async function emitirAtaColegiado(
  reuniaoId: string,
  titulo: string,
  conteudoGerado: string,
  anoLetivo: number
): Promise<AtaColegiado> {
  const { data, error } = await supabase.rpc('rpc_emitir_ata_colegiado', {
    p_reuniao_id: reuniaoId,
    p_titulo: titulo,
    p_conteudo_gerado: conteudoGerado,
    p_ano_letivo: anoLetivo,
  });
  if (error) throw error;
  return data as AtaColegiado;
}

export async function obterAtaColegiado(ataId: string): Promise<AtaColegiado | null> {
  const { data, error } = await supabase.from('atas_colegiado').select('*').eq('id', ataId).maybeSingle();
  if (error) throw error;
  return data;
}

// --- Comunicação institucional (registro novo; entrega reaproveita pushService,
// sem segundo pipeline de notificação) ---
export async function listarComunicados(): Promise<Comunicado[]> {
  const { data, error } = await supabase.from('comunicados').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarComunicadoRascunho(dados: {
  tipo: Comunicado['tipo'];
  titulo: string;
  corpo: string | null;
  destino: Comunicado['destino'];
  destino_ref: string | null;
  autor_id: string;
}): Promise<Comunicado> {
  const { data, error } = await supabase.from('comunicados').insert([{ ...dados, status: 'RASCUNHO' }]).select().single();
  if (error) throw error;
  return data;
}

export async function excluirComunicado(id: string): Promise<void> {
  const { error } = await supabase.from('comunicados').delete().eq('id', id);
  if (error) throw error;
}

// Resolve destinatários via RPC (server-side, único ponto de verdade do mapeamento
// segmento/turma/órgão → usuário) e despacha pela MESMA função de push já usada por
// Biblioteca/Agendamento/Ocorrências — depois marca como publicado.
export async function publicarComunicado(comunicado: Comunicado): Promise<void> {
  const { data: destinatarios, error: rpcError } = await supabase.rpc('rpc_destinatarios_comunicado', {
    p_destino: comunicado.destino,
    p_destino_ref: comunicado.destino_ref,
  });
  if (rpcError) throw rpcError;

  const userIds = ((destinatarios ?? []) as { user_id: string }[]).map((d) => d.user_id);
  if (userIds.length > 0) {
    await sendPushToUsers({
      user_ids: userIds,
      title: comunicado.tipo === 'CONVOCACAO' ? `📢 Convocação: ${comunicado.titulo}` : comunicado.tipo === 'EVENTO' ? `📅 ${comunicado.titulo}` : `📣 ${comunicado.titulo}`,
      message: comunicado.corpo?.slice(0, 120) || comunicado.titulo,
      url: '/?modulo=gestao',
      tag: `comunicado-${comunicado.id}`,
    });
  }

  const { error } = await supabase.from('comunicados').update({ status: 'PUBLICADO', publicado_em: new Date().toISOString() }).eq('id', comunicado.id);
  if (error) throw error;
}

// --- Eventos: reaproveita calendario_eventos (já existente, usado na landing
// pública) em vez de criar eventos_institucionais — ver achado na Etapa 1. ---
export async function criarEventoCalendario(data: string, titulo: string, criadoPor: string): Promise<void> {
  const { error } = await supabase.from('calendario_eventos').insert([{
    data,
    categoria: 'evento:#8b5cf6',
    abreviacao: titulo.slice(0, 3).toUpperCase(),
    descricao: titulo,
    criado_por: criadoPor,
  }]);
  if (error) throw error;
}
