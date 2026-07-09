import { supabase } from '../lib/supabase';
import type { Material, MaterialComSaldo, MovimentacaoMaterial, Requisicao, RequisicaoItem, StatusRequisicao } from '../types/almoxarifado';

// --- Catálogo de materiais ---
export async function listarMateriais(): Promise<Material[]> {
  const { data, error } = await supabase.from('materiais').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

// vw_saldo_material não tem FK declarada pra materiais (é view derivada), então o
// embed automático do PostgREST não funciona aqui — busca as duas e junta no cliente.
export async function listarMateriaisComSaldo(): Promise<MaterialComSaldo[]> {
  const [{ data: materiais, error: erroMateriais }, { data: saldos, error: erroSaldos }] = await Promise.all([
    supabase.from('materiais').select('*').order('nome'),
    supabase.from('vw_saldo_material').select('*'),
  ]);
  if (erroMateriais) throw erroMateriais;
  if (erroSaldos) throw erroSaldos;
  const saldoPorMaterial = new Map((saldos ?? []).map((s) => [s.material_id, Number(s.saldo)]));
  return (materiais ?? []).map((m) => ({ ...m, saldo: saldoPorMaterial.get(m.id) ?? 0 }));
}

export async function criarMaterial(dados: Omit<Material, 'id' | 'criado_em'>): Promise<Material> {
  const { data, error } = await supabase.from('materiais').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarMaterial(id: string, dados: Partial<Material>): Promise<void> {
  const { error } = await supabase.from('materiais').update(dados).eq('id', id);
  if (error) throw error;
}

// --- Extrato de movimentações ---
export async function listarMovimentacoes(materialId?: string): Promise<MovimentacaoMaterial[]> {
  let query = supabase.from('movimentacao_material').select('*').order('criado_em', { ascending: false });
  if (materialId) query = query.eq('material_id', materialId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function registrarMovimentacao(dados: {
  material_id: string;
  tipo: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
  quantidade: number;
  motivo: string;
  referencia?: string | null;
  fonte_recurso?: string | null;
}): Promise<MovimentacaoMaterial> {
  const { data, error } = await supabase.rpc('rpc_registrar_movimentacao_material', {
    p_material_id: dados.material_id,
    p_tipo: dados.tipo,
    p_quantidade: dados.quantidade,
    p_motivo: dados.motivo,
    p_referencia: dados.referencia ?? null,
    p_fonte_recurso: dados.fonte_recurso ?? null,
  });
  if (error) throw error;
  return data as MovimentacaoMaterial;
}

// --- Requisições ---
export interface ItemRequisicaoEntrada {
  material_id: string;
  quantidade: number;
}

export async function criarRequisicao(setor: string, itens: ItemRequisicaoEntrada[]): Promise<Requisicao> {
  const { data, error } = await supabase.rpc('rpc_criar_requisicao', { p_setor: setor, p_itens: itens });
  if (error) throw error;
  return data as Requisicao;
}

export async function listarMinhasRequisicoes(): Promise<Requisicao[]> {
  const { data, error } = await supabase.from('requisicoes').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface RequisicaoDetalhada extends Requisicao {
  solicitante_nome: string;
}

// Nomes resolvidos via `professores` (não há embed direto de requisicoes ->
// usuarios -> pessoas sem depender de sintaxe de FK aninhada ainda não usada neste
// projeto) — o mesmo auth.uid() vale como usuarios.id e professores.user_id.
export async function listarRequisicoesPendentes(): Promise<RequisicaoDetalhada[]> {
  const { data: requisicoes, error } = await supabase
    .from('requisicoes')
    .select('*')
    .eq('status', 'PENDENTE')
    .order('criado_em');
  if (error) throw error;
  return await comSolicitanteNome(requisicoes ?? []);
}

export async function listarTodasRequisicoes(filtroStatus?: StatusRequisicao): Promise<RequisicaoDetalhada[]> {
  let query = supabase.from('requisicoes').select('*').order('criado_em', { ascending: false });
  if (filtroStatus) query = query.eq('status', filtroStatus);
  const { data, error } = await query;
  if (error) throw error;
  return await comSolicitanteNome(data ?? []);
}

async function comSolicitanteNome(requisicoes: Requisicao[]): Promise<RequisicaoDetalhada[]> {
  const ids = [...new Set(requisicoes.map((r) => r.solicitante_id))];
  if (ids.length === 0) return [];
  const { data: professores, error } = await supabase.from('professores').select('user_id, nome').in('user_id', ids);
  if (error) throw error;
  const nomePorUsuario = new Map((professores ?? []).map((p) => [p.user_id, p.nome]));
  return requisicoes.map((r) => ({ ...r, solicitante_nome: nomePorUsuario.get(r.solicitante_id) ?? 'Desconhecido' }));
}

export async function listarItensRequisicao(requisicaoId: string): Promise<(RequisicaoItem & { material_nome: string; material_unidade: string })[]> {
  const { data, error } = await supabase.from('requisicao_itens').select('*, materiais(nome, unidade)').eq('requisicao_id', requisicaoId);
  if (error) throw error;
  return (data ?? []).map((i) => ({
    ...i,
    material_nome: (i as unknown as { materiais: { nome: string; unidade: string } }).materiais.nome,
    material_unidade: (i as unknown as { materiais: { nome: string; unidade: string } }).materiais.unidade,
  }));
}

export interface DecisaoItemRequisicao {
  item_id: string;
  quantidade_atendida: number;
}

export async function atenderRequisicao(requisicaoId: string, decisoes: DecisaoItemRequisicao[]): Promise<Requisicao> {
  const { data, error } = await supabase.rpc('rpc_atender_requisicao', { p_requisicao_id: requisicaoId, p_decisoes: decisoes });
  if (error) throw error;
  return data as Requisicao;
}

export async function recusarRequisicao(requisicaoId: string, motivo: string): Promise<Requisicao> {
  const { data, error } = await supabase.rpc('rpc_recusar_requisicao', { p_requisicao_id: requisicaoId, p_motivo: motivo });
  if (error) throw error;
  return data as Requisicao;
}
