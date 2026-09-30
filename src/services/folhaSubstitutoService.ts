import { supabase } from '../lib/supabase';
import type { LancamentoFolhaSubstituto, NovoLancamentoFolha } from '../types/rh';

export async function listarLancamentosFolha(competencia: string): Promise<LancamentoFolhaSubstituto[]> {
  const { data, error } = await supabase
    .from('folha_substituto_lancamentos')
    .select('*')
    .eq('competencia', competencia)
    .order('data')
    .order('criado_em');
  if (error) throw error;
  return (data ?? []) as LancamentoFolhaSubstituto[];
}

export async function criarLancamentoFolha(dados: NovoLancamentoFolha, registradoPor: string): Promise<void> {
  const { error } = await supabase.from('folha_substituto_lancamentos').insert([{ ...dados, registrado_por: registradoPor }]);
  if (error) throw error;
}

export async function atualizarLancamentoFolha(id: string, dados: Partial<LancamentoFolhaSubstituto>): Promise<void> {
  const { error } = await supabase.from('folha_substituto_lancamentos').update(dados).eq('id', id);
  if (error) throw error;
}

export async function excluirLancamentoFolha(id: string): Promise<void> {
  const { error } = await supabase.from('folha_substituto_lancamentos').delete().eq('id', id);
  if (error) throw error;
}

// Traz os atestados com substituto que ainda não têm lançamento nesta competência.
export async function importarAtestadosParaFolha(competencia: string): Promise<number> {
  const { data, error } = await supabase.rpc('rpc_folha_importar_atestados', { p_competencia: competencia });
  if (error) throw error;
  return (data as number) ?? 0;
}
