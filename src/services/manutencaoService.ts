import { supabase } from '../lib/supabase';
import type { ChamadoManutencao, HistoricoChamado, OrdemServico, StatusChamado, CategoriaChamado, PrioridadeChamado } from '../types/manutencao';

export interface ChamadoDetalhado extends ChamadoManutencao {
  aberto_por_nome: string;
  responsavel_nome: string | null;
}

async function comNomes(chamados: ChamadoManutencao[]): Promise<ChamadoDetalhado[]> {
  const ids = [...new Set([...chamados.map((c) => c.aberto_por), ...chamados.map((c) => c.responsavel_id)].filter((id): id is string => !!id))];
  if (ids.length === 0) return chamados.map((c) => ({ ...c, aberto_por_nome: 'Desconhecido', responsavel_nome: null }));
  const { data: professores, error } = await supabase.from('professores').select('user_id, nome').in('user_id', ids);
  if (error) throw error;
  const nomePorUsuario = new Map((professores ?? []).map((p) => [p.user_id, p.nome]));
  return chamados.map((c) => ({
    ...c,
    aberto_por_nome: (c.aberto_por && nomePorUsuario.get(c.aberto_por)) ?? 'Desconhecido',
    responsavel_nome: (c.responsavel_id && nomePorUsuario.get(c.responsavel_id)) ?? null,
  }));
}

export async function listarChamados(filtroStatus?: StatusChamado): Promise<ChamadoDetalhado[]> {
  let query = supabase.from('chamados_manutencao').select('*').order('aberto_em', { ascending: false });
  if (filtroStatus) query = query.eq('status', filtroStatus);
  const { data, error } = await query;
  if (error) throw error;
  return await comNomes(data ?? []);
}

export async function criarChamado(dados: {
  titulo: string;
  descricao: string | null;
  categoria: CategoriaChamado;
  local: string;
  prioridade: PrioridadeChamado;
  aberto_por: string;
  bem_patrimonial_id?: string | null;
}): Promise<ChamadoManutencao> {
  const { data, error } = await supabase.from('chamados_manutencao').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarChamado(id: string, dados: Partial<Pick<ChamadoManutencao, 'status' | 'responsavel_id' | 'observacoes'>>): Promise<void> {
  const { error } = await supabase.from('chamados_manutencao').update(dados).eq('id', id);
  if (error) throw error;
}

export async function listarHistorico(chamadoId: string): Promise<HistoricoChamado[]> {
  const { data, error } = await supabase.from('chamados_manutencao_historico').select('*').eq('chamado_id', chamadoId).order('alterado_em');
  if (error) throw error;
  return data ?? [];
}

export async function listarOrdensServico(chamadoId: string): Promise<OrdemServico[]> {
  const { data, error } = await supabase.from('ordens_servico').select('*').eq('chamado_id', chamadoId).order('data', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarOrdemServico(dados: { chamado_id: string; responsavel: string; custo: number | null; data: string; observacoes: string | null }): Promise<OrdemServico> {
  const { data, error } = await supabase.from('ordens_servico').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

// Lista de servidores com login (user_id) pra GESTAO escolher quem designar como
// responsável por um chamado.
export async function listarServidoresParaDesignar(): Promise<{ user_id: string; nome: string }[]> {
  const { data, error } = await supabase.from('professores').select('user_id, nome').not('user_id', 'is', null).order('nome');
  if (error) throw error;
  return data ?? [];
}
