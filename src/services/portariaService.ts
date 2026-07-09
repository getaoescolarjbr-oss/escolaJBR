import { supabase } from '../lib/supabase';
import type { Visitante, RegistroPortaria } from '../types/portaria';

export async function listarVisitantesPresentes(): Promise<Visitante[]> {
  const { data, error } = await supabase.from('visitantes').select('*').is('saida_em', null).order('entrada_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listarVisitantes(dataInicio?: string): Promise<Visitante[]> {
  let query = supabase.from('visitantes').select('*').order('entrada_em', { ascending: false });
  if (dataInicio) query = query.gte('entrada_em', dataInicio);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function registrarEntradaVisitante(dados: {
  nome: string;
  documento: string;
  motivo: string | null;
  pessoa_a_visitar: string | null;
  registrado_por: string;
}): Promise<Visitante> {
  const { data, error } = await supabase.from('visitantes').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function registrarSaidaVisitante(id: string): Promise<void> {
  const { error } = await supabase.from('visitantes').update({ saida_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function listarRegistrosPortaria(): Promise<RegistroPortaria[]> {
  const { data, error } = await supabase.from('registros_portaria').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarRegistroPortaria(dados: { tipo: string; descricao: string; criado_por: string }): Promise<RegistroPortaria> {
  const { data, error } = await supabase.from('registros_portaria').insert([dados]).select().single();
  if (error) throw error;
  return data;
}
