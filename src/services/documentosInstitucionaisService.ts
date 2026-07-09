import { supabase } from '../lib/supabase';
import { logAcesso } from './auditoriaService';
import type { DocumentoInstitucional, VersaoDocumento } from '../types/documentosInstitucionais';

// --- Documentos institucionais ---
export async function listarDocumentos(): Promise<DocumentoInstitucional[]> {
  const { data, error } = await supabase.from('documentos_institucionais').select('*').order('tipo').order('titulo');
  if (error) throw error;
  return data ?? [];
}

export async function criarDocumento(dados: {
  tipo: DocumentoInstitucional['tipo'];
  titulo: string;
  descricao: string | null;
  visibilidade: DocumentoInstitucional['visibilidade'];
}): Promise<DocumentoInstitucional> {
  const { data, error } = await supabase.from('documentos_institucionais').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarDocumento(id: string, dados: Partial<DocumentoInstitucional>): Promise<void> {
  const { error } = await supabase.from('documentos_institucionais').update(dados).eq('id', id);
  if (error) throw error;
}

// --- Versões (motor não destrutivo — ver create_gestao_documentos_institucionais_schema.sql) ---
export async function listarVersoes(documentoId: string): Promise<VersaoDocumento[]> {
  const { data, error } = await supabase.from('versoes_documento').select('*').eq('documento_id', documentoId).order('versao', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const BUCKET_DOCUMENTOS_INSTITUCIONAIS = 'documentos-institucionais';

// Upload primeiro, depois a RPC registra a versão (nasce sempre RASCUNHO — nunca
// afeta a vigente; número de versão calculado atomicamente na RPC).
export async function criarVersaoDocumento(documentoId: string, arquivo: File, resumoAlteracoes: string): Promise<VersaoDocumento> {
  const path = `${documentoId}/${Date.now()}-${arquivo.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET_DOCUMENTOS_INSTITUCIONAIS).upload(path, arquivo, { upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.rpc('rpc_criar_versao_documento', {
    p_documento_id: documentoId,
    p_arquivo_path: path,
    p_resumo_alteracoes: resumoAlteracoes || null,
  });
  if (error) throw error;
  return data as VersaoDocumento;
}

// Cada geração de link é uma leitura de documento institucional — registrada em
// auditoria (best-effort, mesmo padrão já usado no resto do projeto).
export async function obterUrlVersao(versao: VersaoDocumento): Promise<string> {
  if (!versao.arquivo_path) throw new Error('Nenhum arquivo anexado a esta versão.');
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS_INSTITUCIONAIS).createSignedUrl(versao.arquivo_path, 60);
  if (error) throw error;
  await logAcesso('versoes_documento', versao.id, null, 'READ');
  return data.signedUrl;
}

// --- Promoção a vigente (motor RPC) ---
export async function promoverVersaoVigente(versaoId: string, orgaoAprovadorId: string | null): Promise<VersaoDocumento> {
  const { data, error } = await supabase.rpc('rpc_promover_versao_vigente', {
    p_versao_id: versaoId,
    p_orgao_aprovador_id: orgaoAprovadorId,
  });
  if (error) throw error;
  return data as VersaoDocumento;
}

// orgaos_colegiados tem SELECT restrito a GESTAO ou membro do próprio órgão
// (create_gestao_governanca_schema.sql) — COORDENACAO, que também aprova PPP/
// Regimento aqui, não conseguiria listar órgãos pra escolher o aprovador. RPC mínima
// (id+nome+tipo, não abre membros/mandatos/CNPJ), sem afrouxar a RLS de Governança.
export async function listarOrgaosParaSelecao(): Promise<{ id: string; nome: string; tipo: string }[]> {
  const { data, error } = await supabase.rpc('rpc_listar_orgaos_para_selecao');
  if (error) throw error;
  return data ?? [];
}
