import { supabase } from '../lib/supabase';
import { logAcesso } from './auditoriaService';
import type { Pessoa, VinculosPessoa, AlunoResponsavelVinculo } from '../types/pessoas';

// Usada pela tela "Minha Conta" — depende da policy pessoas_select_propria
// (create_fundacao_perfil_rls.sql), que libera cada usuário a ler só a própria pessoa.
export async function obterMinhaPessoa(usuarioId: string): Promise<Pessoa | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('pessoas(*)')
    .eq('id', usuarioId)
    .single();
  if (error) throw error;
  return (data as unknown as { pessoas: Pessoa | null })?.pessoas ?? null;
}

export async function listarPessoas(termoBusca: string): Promise<Pessoa[]> {
  let query = supabase.from('pessoas').select('*').order('nome');
  const termo = termoBusca.trim();
  if (termo) {
    const like = `%${termo}%`;
    query = query.or(`nome.ilike.${like},cpf.ilike.${like},email.ilike.${like}`);
  }
  const { data, error } = await query.limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function criarPessoa(dados: Partial<Pessoa>): Promise<Pessoa> {
  const { data, error } = await supabase.from('pessoas').insert([dados]).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarPessoa(id: string, dados: Partial<Pessoa>): Promise<void> {
  const { error } = await supabase.from('pessoas').update(dados).eq('id', id);
  if (error) throw error;
}

export async function excluirPessoa(id: string): Promise<void> {
  const { error } = await supabase.from('pessoas').delete().eq('id', id);
  if (error) throw error;
}

// Visualizar o cadastro completo de uma pessoa conta como acesso a dado sensível —
// registra na trilha (best-effort, ver services/auditoriaService.ts).
export async function obterVinculos(pessoaId: string): Promise<VinculosPessoa> {
  const { data, error } = await supabase.rpc('rpc_vinculos_pessoa', { p_pessoa_id: pessoaId });
  if (error) throw error;
  await logAcesso('pessoas', pessoaId, pessoaId, 'READ');
  return (data ?? { aluno: null, servidor: null, responsavel: null }) as VinculosPessoa;
}

export async function tornarResponsavel(pessoaId: string, parentesco: string) {
  const { data, error } = await supabase
    .from('responsaveis')
    .insert([{ pessoa_id: pessoaId, parentesco: parentesco || null }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listarAlunosVinculados(responsavelId: string): Promise<AlunoResponsavelVinculo[]> {
  const { data, error } = await supabase
    .from('aluno_responsaveis')
    .select('id, aluno_id, responsavel_id, principal, alunos(nome)')
    .eq('responsavel_id', responsavelId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    aluno_id: row.aluno_id,
    responsavel_id: row.responsavel_id,
    principal: row.principal,
    aluno_nome: (row as unknown as { alunos: { nome: string } | null }).alunos?.nome,
  }));
}

export async function buscarAlunosParaVinculo(termo: string): Promise<{ id: string; nome: string }[]> {
  if (!termo.trim()) return [];
  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome')
    .ilike('nome', `%${termo.trim()}%`)
    .limit(15);
  if (error) throw error;
  return data ?? [];
}

export async function vincularAluno(alunoId: string, responsavelId: string, principal: boolean) {
  const { error } = await supabase
    .from('aluno_responsaveis')
    .insert([{ aluno_id: alunoId, responsavel_id: responsavelId, principal }]);
  if (error) throw error;
}

export async function desvincularAluno(vinculoId: string) {
  const { error } = await supabase.from('aluno_responsaveis').delete().eq('id', vinculoId);
  if (error) throw error;
}

// Responsáveis vinculados a um Aluno (direção inversa de listarAlunosVinculados) —
// usado para saber quem pode dar consentimento LGPD em nome desse aluno.
export async function listarResponsaveisDoAluno(alunoId: string): Promise<{ responsavelId: string; pessoaId: string; nome: string }[]> {
  const { data, error } = await supabase
    .from('aluno_responsaveis')
    .select('responsavel_id, responsaveis(pessoa_id, pessoas(nome))')
    .eq('aluno_id', alunoId);
  if (error) throw error;
  type Row = { responsavel_id: string; responsaveis: { pessoa_id: string; pessoas: { nome: string } | null } | null };
  return (data as unknown as Row[] ?? [])
    .filter((row) => row.responsaveis)
    .map((row) => ({
      responsavelId: row.responsavel_id,
      pessoaId: row.responsaveis!.pessoa_id,
      nome: row.responsaveis!.pessoas?.nome ?? '(sem nome)',
    }));
}
