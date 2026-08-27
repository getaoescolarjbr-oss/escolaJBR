import { supabase } from '../lib/supabase';
import type { FilterOptions, FiltroQuestoes, Question, TaxonomyField, TaxonomyTerm } from '../types/bancoQuestoes';
import { QUESTION_SELECT_FIELDS } from '../types/bancoQuestoes';

export async function buscarFilterOptions(): Promise<FilterOptions> {
  const { data, error } = await supabase.rpc('question_bank_filter_options').single();
  if (error) throw error;
  const d = data as Record<string, unknown>;
  return {
    disciplines: (d.disciplines as string[]) ?? [],
    difficulties: (d.difficulties as string[]) ?? [],
    orgaos: (d.orgaos as string[]) ?? [],
    cargos: (d.cargos as string[]) ?? [],
    anos: (d.anos as number[]) ?? [],
    assuntos: (d.assuntos as string[]) ?? [],
    bancas: (d.bancas as string[]) ?? [],
    levels: (d.levels as string[]) ?? [],
    areas: (d.areas as string[]) ?? [],
  };
}

export async function buscarAssuntosPorDisciplina(discipline: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('question_bank_assuntos_by_discipline', { p_discipline: discipline });
  if (error) throw error;
  return (data as string[]) ?? [];
}

export interface ListaQuestoes {
  questoes: Question[];
  total: number;
}

export async function listarQuestoes(filtro: FiltroQuestoes): Promise<ListaQuestoes> {
  const page = filtro.page ?? 0;
  const pageSize = filtro.pageSize ?? 20;
  let query = supabase
    .from('questions')
    .select(QUESTION_SELECT_FIELDS, { count: 'exact' })
    .eq('active', true)
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (filtro.discipline) query = query.eq('discipline', filtro.discipline);
  if (filtro.level) query = query.eq('level', filtro.level);
  if (filtro.area) query = query.eq('area', filtro.area);
  if (filtro.banca) query = query.eq('banca', filtro.banca);
  if (filtro.ano) query = query.eq('ano', filtro.ano);
  if (filtro.difficulty) query = query.eq('difficulty', filtro.difficulty);
  if (filtro.assunto) query = query.eq('assunto', filtro.assunto);
  if (filtro.busca) query = query.ilike('statement', `%${filtro.busca}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { questoes: (data as unknown as Question[]) ?? [], total: count ?? 0 };
}

// Cria ou atualiza o texto associado (passagem de apoio) de uma questão. Retorna o id
// pra ser gravado em questions.support_text_id.
export async function salvarTextoApoio(id: string | null, discipline: string, content: string): Promise<string> {
  if (id) {
    const { error } = await supabase.from('support_texts').update({ discipline, content }).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from('support_texts').insert([{ discipline, content }]).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function criarQuestao(dados: Partial<Question>): Promise<Question> {
  const { data, error } = await supabase.from('questions').insert([dados]).select(QUESTION_SELECT_FIELDS).single();
  if (error) throw error;
  return data as unknown as Question;
}

export async function atualizarQuestao(id: string, dados: Partial<Question>): Promise<void> {
  const { error } = await supabase.from('questions').update(dados).eq('id', id);
  if (error) throw error;
}

export async function excluirQuestao(id: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw error;
}

export async function listarTermos(field?: TaxonomyField): Promise<TaxonomyTerm[]> {
  let query = supabase.from('question_taxonomy_terms').select('*').order('value');
  if (field) query = query.eq('field', field);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function criarTermo(field: TaxonomyField, value: string): Promise<TaxonomyTerm> {
  const { data, error } = await supabase.from('question_taxonomy_terms').insert([{ field, value }]).select().single();
  if (error) throw error;
  return data;
}

export async function excluirTermo(id: string): Promise<void> {
  const { error } = await supabase.from('question_taxonomy_terms').delete().eq('id', id);
  if (error) throw error;
}

export async function contarQuestoesPorDisciplina(discipline: string): Promise<number> {
  const { count, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('discipline', discipline);
  if (error) throw error;
  return count ?? 0;
}

// Remove a disciplina inteira: apaga as questões e os textos de apoio vinculados a ela
// (o RPC de filtros junta discipline de `questions` com `question_taxonomy_terms`, então só
// excluir o termo não tira a disciplina do banco enquanto sobrarem questões com esse texto).
export async function excluirDisciplinaComQuestoes(discipline: string, termoId?: string): Promise<void> {
  const { error: qErr } = await supabase.from('questions').delete().eq('discipline', discipline);
  if (qErr) throw qErr;

  const { error: stErr } = await supabase.from('support_texts').delete().eq('discipline', discipline);
  if (stErr) throw stErr;

  if (termoId) {
    const { error: termoErr } = await supabase.from('question_taxonomy_terms').delete().eq('id', termoId);
    if (termoErr) throw termoErr;
  } else {
    const { error: termoErr } = await supabase
      .from('question_taxonomy_terms')
      .delete()
      .eq('field', 'discipline')
      .eq('value', discipline);
    if (termoErr) throw termoErr;
  }
}
