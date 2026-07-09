import { supabase } from '../lib/supabase';

// Supabase Auth só autentica por e-mail — alunos fazem login por usuário, então cada
// conta de aluno usa um e-mail sintético neste domínio (nunca uma caixa de e-mail
// real; por isso a confirmação de e-mail precisa estar desligada no projeto, do
// contrário ninguém recebe o link de confirmação). Ver rpc_resolver_username no banco.
export const DOMINIO_EMAIL_ALUNO = 'alunos.jbr.local';

export interface CadastroBibliotecaPendente {
  id: string;
  auth_user_id: string;
  nome_informado: string;
  data_nascimento_informada: string | null;
  turma_id: string | null;
  turma_nome: string | null;
  responsavel_nome: string | null;
  responsavel_contato: string | null;
  aceite_termos: boolean;
  aceite_funcoes_sociais: boolean;
  username: string;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  pessoa_id_vinculada: string | null;
  analisado_por: string | null;
  analisado_em: string | null;
  observacoes_analise: string | null;
  criado_em: string;
}

export interface DadosCadastroAluno {
  username: string;
  senha: string;
  nomeInformado: string;
  dataNascimento: string | null;
  turmaId: string | null;
  responsavelNome: string | null;
  responsavelContato: string | null;
  aceiteTermos: boolean;
  aceiteFuncoesSociais: boolean;
}

function normalizarUsername(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, '.');
}

export function emailSinteticoAluno(username: string): string {
  return `${normalizarUsername(username)}@${DOMINIO_EMAIL_ALUNO}`;
}

// Cria a conta de autenticação (com o e-mail sintético) e o pedido de cadastro. Não
// cria `pessoa`/`usuarios` agora — só a Secretaria, ao aprovar, vincula esta conta ao
// registro de aluno já matriculado (ver create_biblioteca_cadastro_pendente.sql).
export async function solicitarCadastroBiblioteca(dados: DadosCadastroAluno): Promise<void> {
  const username = normalizarUsername(dados.username);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: emailSinteticoAluno(username),
    password: dados.senha,
  });
  if (authError) throw authError;
  if (!authData.user) throw new Error('Não foi possível criar a conta. Tente novamente.');

  const { error } = await supabase.from('cadastros_biblioteca_pendentes').insert([{
    auth_user_id: authData.user.id,
    nome_informado: dados.nomeInformado,
    data_nascimento_informada: dados.dataNascimento,
    turma_id: dados.turmaId,
    responsavel_nome: dados.responsavelNome,
    responsavel_contato: dados.responsavelContato,
    aceite_termos: dados.aceiteTermos,
    aceite_funcoes_sociais: dados.aceiteFuncoesSociais,
    username,
  }]);
  if (error) throw error;
}

// Resolve usuário -> e-mail para o login (RPC não vaza se o usuário existe ou não).
export async function resolverEmailPorUsername(username: string): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_resolver_username', { p_username: normalizarUsername(username) });
  if (error) throw error;
  return data as string;
}

// Status do próprio pedido, usado pela tela "aguardando aprovação" — o aluno já tem
// sessão (o signUp cria uma), mas ainda não tem papel nenhum até a Secretaria aprovar.
export async function meuCadastroPendente(authUserId: string): Promise<CadastroBibliotecaPendente | null> {
  const { data, error } = await supabase
    .from('cadastros_biblioteca_pendentes')
    .select('*, turmas(nome)')
    .eq('auth_user_id', authUserId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, turma_nome: (data as unknown as { turmas: { nome: string } | null }).turmas?.nome ?? null };
}

export async function listarCadastrosPendentes(): Promise<CadastroBibliotecaPendente[]> {
  const { data, error } = await supabase
    .from('cadastros_biblioteca_pendentes')
    .select('*, turmas(nome)')
    .eq('status', 'PENDENTE')
    .order('criado_em');
  if (error) throw error;
  return (data ?? []).map((c) => ({ ...c, turma_nome: (c as unknown as { turmas: { nome: string } | null }).turmas?.nome ?? null }));
}

export async function aprovarCadastroBiblioteca(cadastroId: string, alunoId: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_aprovar_cadastro_biblioteca', { p_cadastro_id: cadastroId, p_aluno_id: alunoId });
  if (error) throw error;
}

export async function rejeitarCadastroBiblioteca(cadastroId: string, observacoes: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('cadastros_biblioteca_pendentes')
    .update({
      status: 'REJEITADO',
      analisado_por: userData.user?.id ?? null,
      analisado_em: new Date().toISOString(),
      observacoes_analise: observacoes || null,
    })
    .eq('id', cadastroId);
  if (error) throw error;
}
