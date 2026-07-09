import { supabase } from '../lib/supabase';
import type { Consentimento, TipoConsentimento, SolicitacaoLgpd } from '../types/lgpd';

export async function listarConsentimentos(pessoaId: string): Promise<Consentimento[]> {
  const { data, error } = await supabase
    .from('consentimentos')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Consentimento é imutável (sem UPDATE/DELETE no banco) — revogar = registrar uma
// nova linha com aceito=false, nunca apagar a anterior.
export async function registrarConsentimento(
  pessoaId: string,
  aceitoPorPessoaId: string,
  tipo: TipoConsentimento,
  aceito: boolean,
  versaoTermo = 'v1'
) {
  const { error } = await supabase.from('consentimentos').insert([
    { pessoa_id: pessoaId, aceito_por_pessoa_id: aceitoPorPessoaId, tipo, aceito, versao_termo: versaoTermo },
  ]);
  if (error) throw error;
}

export async function listarSolicitacoes(pessoaId: string): Promise<SolicitacaoLgpd[]> {
  const { data, error } = await supabase
    .from('solicitacoes_lgpd')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .order('solicitado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function criarSolicitacao(pessoaId: string, tipo: 'EXPORTAR' | 'EXCLUIR', usuarioId: string, observacoes?: string) {
  const { data, error } = await supabase
    .from('solicitacoes_lgpd')
    .insert([{ pessoa_id: pessoaId, tipo, solicitado_por: usuarioId, observacoes: observacoes || null }])
    .select()
    .single();
  if (error) throw error;
  return data as SolicitacaoLgpd;
}

// Cria a solicitação, executa a exportação (RPC grava o EXPORT em auditoria dentro da
// mesma transação — não depende do cliente chamar nada depois) e devolve o JSON para
// download local. Não sobe para um bucket ainda: o "arquivo" é o download direto.
export async function exportarDadosPessoa(pessoaId: string, usuarioId: string) {
  const solicitacao = await criarSolicitacao(pessoaId, 'EXPORTAR', usuarioId);

  const { data, error } = await supabase.rpc('rpc_exportar_pessoa', { p_pessoa_id: pessoaId });
  if (error) throw error;

  await supabase
    .from('solicitacoes_lgpd')
    .update({ status: 'CONCLUIDA', concluido_em: new Date().toISOString() })
    .eq('id', solicitacao.id);

  return data;
}

// Anonimiza os campos de identidade em `pessoas` (não é DELETE físico — ver
// create_fundacao_lgpd.sql para o porquê). Só GESTAO pode executar.
export async function excluirDadosPessoa(pessoaId: string, usuarioId: string, observacoes?: string) {
  const solicitacao = await criarSolicitacao(pessoaId, 'EXCLUIR', usuarioId, observacoes);
  const { error } = await supabase.rpc('rpc_excluir_pessoa', {
    p_pessoa_id: pessoaId,
    p_solicitacao_id: solicitacao.id,
  });
  if (error) throw error;
}
