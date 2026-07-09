import { supabase } from '../lib/supabase';
import { logAcesso } from './auditoriaService';
import type { Protocolo, AnexoProtocolo, StatusProtocolo } from '../types/secretaria';

const BUCKET = 'documentos-pessoas';

export async function listarProtocolos(filtroStatus?: StatusProtocolo): Promise<Protocolo[]> {
  let query = supabase.from('protocolos').select('*').order('recebido_em', { ascending: false });
  if (filtroStatus) query = query.eq('status', filtroStatus);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// numero/ano são reservados atomicamente dentro de rpc_criar_protocolo (server-side) —
// nunca calculados no cliente, evitando duplicidade sob concorrência.
export async function criarProtocolo(dados: {
  tipo: string;
  assunto: string;
  interessado: string;
  pessoa_id: string | null;
  prazo: string | null;
  observacoes: string | null;
}): Promise<Protocolo> {
  const { data, error } = await supabase.rpc('rpc_criar_protocolo', {
    p_tipo: dados.tipo,
    p_assunto: dados.assunto,
    p_interessado: dados.interessado,
    p_pessoa_id: dados.pessoa_id,
    p_prazo: dados.prazo,
    p_observacoes: dados.observacoes,
  });
  if (error) throw error;
  return data as Protocolo;
}

export async function atualizarProtocolo(id: string, dados: Partial<Protocolo>): Promise<void> {
  const { error } = await supabase.from('protocolos').update(dados).eq('id', id);
  if (error) throw error;
}

export async function listarAnexos(protocoloId: string): Promise<AnexoProtocolo[]> {
  const { data, error } = await supabase
    .from('anexos_protocolo')
    .select('*')
    .eq('protocolo_id', protocoloId)
    .order('enviado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function anexarArquivo(protocoloId: string, arquivo: File, enviadoPor: string): Promise<AnexoProtocolo> {
  const path = `protocolos/${protocoloId}/${Date.now()}-${arquivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arquivo, { upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('anexos_protocolo')
    .insert([{ protocolo_id: protocoloId, nome_arquivo: arquivo.name, arquivo_path: path, enviado_por: enviadoPor }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obterUrlAssinadaAnexo(anexo: AnexoProtocolo, pessoaId: string | null): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(anexo.arquivo_path, 60);
  if (error) throw error;
  await logAcesso('anexos_protocolo', anexo.id, pessoaId, 'READ');
  return data.signedUrl;
}
