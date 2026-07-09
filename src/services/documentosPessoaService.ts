import { supabase } from '../lib/supabase';
import { logAcesso } from './auditoriaService';
import type { DocumentoPessoa, TipoDocumentoPessoa } from '../types/secretaria';

const BUCKET = 'documentos-pessoas';

export async function listarDocumentos(pessoaId: string): Promise<DocumentoPessoa[]> {
  const { data, error } = await supabase
    .from('documentos_pessoa')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .order('enviado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function enviarDocumento(
  pessoaId: string,
  tipo: TipoDocumentoPessoa,
  arquivo: File,
  enviadoPor: string,
  observacoes?: string
): Promise<DocumentoPessoa> {
  const path = `pessoas/${pessoaId}/${Date.now()}-${arquivo.name}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arquivo, { upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('documentos_pessoa')
    .insert([{ pessoa_id: pessoaId, tipo, nome_arquivo: arquivo.name, arquivo_path: path, enviado_por: enviadoPor, observacoes: observacoes || null }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Bucket privado: a signed URL só é gerada se a RLS de storage.objects permitir SELECT
// (GESTAO/SECRETARIA). Cada geração de link é uma leitura de dado sensível — registra
// best-effort em auditoria (mesma limitação documentada em auditoriaService.ts).
export async function obterUrlAssinada(documento: DocumentoPessoa): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(documento.arquivo_path, 60);
  if (error) throw error;
  await logAcesso('documentos_pessoa', documento.id, documento.pessoa_id, 'READ');
  return data.signedUrl;
}

export async function excluirDocumento(documento: DocumentoPessoa): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([documento.arquivo_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('documentos_pessoa').delete().eq('id', documento.id);
  if (error) throw error;
}
