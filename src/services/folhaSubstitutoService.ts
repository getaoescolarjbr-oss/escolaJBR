import { supabase } from '../lib/supabase';
import type { LancamentoFolhaSubstituto, NovoLancamentoFolha, SubstitutoRapido } from '../types/rh';

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

export interface AulaDoProfessor { turma_id: string; dia_semana: number } // 1 = segunda ... 5 = sexta

// Turmas de um professor: aulas da grade (horarios) e turmas das alocações (usadas quando
// o professor não tem grade cadastrada).
export async function listarTurmasDoProfessor(professorId: string): Promise<{ aulas: AulaDoProfessor[]; alocadas: string[] }> {
  const [h, a] = await Promise.all([
    supabase.from('horarios').select('turma_id, dia_semana').eq('professor_id', professorId),
    supabase.from('alocacoes_v2').select('turma_id').eq('professor_id', professorId).eq('is_espelho', false),
  ]);
  if (h.error) throw h.error;
  if (a.error) throw a.error;
  return {
    aulas: ((h.data ?? []) as AulaDoProfessor[]).filter((x) => x.turma_id),
    alocadas: Array.from(new Set(((a.data ?? []) as { turma_id: string }[]).map((x) => x.turma_id).filter(Boolean))),
  };
}

export async function listarSubstitutosRapidos(): Promise<SubstitutoRapido[]> {
  const { data, error } = await supabase.from('substitutos_rapidos').select('*').eq('ativo', true).order('nome');
  if (error) throw error;
  return (data ?? []) as SubstitutoRapido[];
}

export async function criarSubstitutoRapido(dados: { nome: string; telefone: string; cpf: string }, criadoPor: string): Promise<SubstitutoRapido> {
  const { data, error } = await supabase
    .from('substitutos_rapidos')
    .insert([{
      nome: dados.nome.trim(),
      telefone: dados.telefone.replace(/\D/g, '') || null,
      cpf: dados.cpf.replace(/\D/g, '') || null,
      criado_por: criadoPor,
    }])
    .select()
    .single();
  if (error) {
    // 23505 = já existe (mesmo nome ou mesmo CPF entre os cadastros ativos).
    if (error.code === '23505') throw new Error('Já existe um substituto cadastrado com esse nome ou CPF. Escolha-o na lista.');
    throw error;
  }
  return data as SubstitutoRapido;
}
