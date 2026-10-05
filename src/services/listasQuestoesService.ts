import { supabase } from '../lib/supabase';

// Listas pessoais de questões (privadas do usuário): o professor separa questões do banco para
// usar depois, sem precisar abrir uma avaliação. question_lista_itens.question_id não tem FK,
// porque parte das questões vem do acervo externo (ver acervoClient.ts).
export interface ListaQuestoes {
  id: string;
  nome: string;
  total: number;
}

export async function listarListasQuestoes(): Promise<ListaQuestoes[]> {
  const { data, error } = await supabase
    .from('question_listas')
    .select('id, nome, created_at, question_lista_itens(count)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((l) => {
    const contagem = (l as unknown as { question_lista_itens: { count: number }[] }).question_lista_itens;
    return { id: l.id as string, nome: l.nome as string, total: contagem?.[0]?.count ?? 0 };
  });
}

export async function criarListaQuestoes(nome: string): Promise<string> {
  const { data, error } = await supabase.from('question_listas').insert([{ nome: nome.trim() }]).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function renomearListaQuestoes(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from('question_listas').update({ nome: nome.trim() }).eq('id', id);
  if (error) throw error;
}

export async function excluirListaQuestoes(id: string): Promise<void> {
  const { error } = await supabase.from('question_listas').delete().eq('id', id);
  if (error) throw error;
}

export async function adicionarQuestoesNaLista(listaId: string, questionIds: string[]): Promise<void> {
  if (questionIds.length === 0) return;
  const { error } = await supabase
    .from('question_lista_itens')
    .upsert(questionIds.map((question_id) => ({ lista_id: listaId, question_id })), { onConflict: 'lista_id,question_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function removerQuestaoDaLista(listaId: string, questionId: string): Promise<void> {
  const { error } = await supabase.from('question_lista_itens').delete().eq('lista_id', listaId).eq('question_id', questionId);
  if (error) throw error;
}

export async function obterIdsDaLista(listaId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('question_lista_itens')
    .select('question_id')
    .eq('lista_id', listaId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.question_id as string);
}
