import { supabase } from '../lib/supabase';
import type { BemPatrimonial, HistoricoBemPatrimonial } from '../types/patrimonio';

export async function listarBens(): Promise<BemPatrimonial[]> {
  const { data, error } = await supabase.from('bens_patrimoniais').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function criarBem(dados: {
  numero_patrimonio: string;
  nome: string;
  descricao: string | null;
  categoria: BemPatrimonial['categoria'];
  local_atual: string;
  data_aquisicao: string | null;
  valor_aquisicao: number | null;
  fonte_recurso: string | null;
  criado_por: string;
}): Promise<BemPatrimonial> {
  const { data, error } = await supabase.from('bens_patrimoniais').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarBem(id: string, dados: Partial<Pick<BemPatrimonial, 'situacao' | 'local_atual' | 'observacoes' | 'ativo' | 'responsavel_id'>>): Promise<void> {
  const { error } = await supabase.from('bens_patrimoniais').update(dados).eq('id', id);
  if (error) throw error;
}

export async function listarHistoricoBem(bemId: string): Promise<HistoricoBemPatrimonial[]> {
  const { data, error } = await supabase.from('bens_patrimoniais_historico').select('*').eq('bem_id', bemId).order('alterado_em');
  if (error) throw error;
  return data ?? [];
}
