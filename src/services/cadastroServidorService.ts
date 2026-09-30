import { supabase } from '../lib/supabase';
import type { Papel } from '../types/rbac';
import { soDigitos } from '../utils/cadastroServidor';

// Cadastro de servidor com aprovação (ver create_cadastro_servidor_com_aprovacao.sql).
// Quem se cadastra cria a conta de autenticação + um pedido; só a Secretaria/Gestão, ao
// aprovar, cria professor/pessoa/usuário/papel. Antes disso a conta não tem acesso a nada.

export interface DadosCadastroServidor {
  email: string;
  senha: string;
  nome: string;
  cargo: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  areaConhecimento: string;
  statusServidor: string;
  aceiteLgpd: boolean;
}

export interface CadastroServidorPendente {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  cargo: string;
  cpf: string;
  data_nascimento: string;
  telefone: string;
  area_conhecimento: string | null;
  status_servidor: string;
  aceite_lgpd: boolean;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  papel_concedido: Papel | null;
  observacoes_analise: string | null;
  criado_em: string;
}

// Resposta só sim/não (o front não recebe a lista de e-mails da escola).
export async function emailJaCadastradoPelaEscola(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('rpc_email_de_professor_existe', { p_email: email });
  if (error) throw error;
  return Boolean(data);
}

export async function solicitarCadastroServidor(dados: DadosCadastroServidor): Promise<void> {
  const email = dados.email.trim().toLowerCase();
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: dados.senha });
  if (authError) throw authError;
  if (!authData.user) throw new Error('Não foi possível criar a conta. Tente novamente.');
  // Com confirmação de e-mail ligada o signUp não devolve sessão e o INSERT abaixo seria
  // negado pela RLS: falha aqui com mensagem clara em vez de deixar conta sem pedido.
  if (!authData.session) {
    throw new Error('Conta criada, mas é preciso confirmar o e-mail antes de enviar o cadastro. Confirme e tente novamente.');
  }

  const { error } = await supabase.from('cadastros_servidores_pendentes').insert([{
    auth_user_id: authData.user.id,
    nome: dados.nome.trim(),
    email,
    cargo: dados.cargo,
    cpf: soDigitos(dados.cpf),
    data_nascimento: dados.dataNascimento,
    telefone: soDigitos(dados.telefone),
    area_conhecimento: dados.areaConhecimento || null,
    status_servidor: dados.statusServidor,
    aceite_lgpd: dados.aceiteLgpd,
  }]);
  if (error) throw error;
}

export async function meuCadastroServidor(authUserId: string): Promise<CadastroServidorPendente | null> {
  const { data, error } = await supabase
    .from('cadastros_servidores_pendentes')
    .select('*')
    .eq('auth_user_id', authUserId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CadastroServidorPendente | null) ?? null;
}

export async function listarCadastrosServidoresPendentes(): Promise<CadastroServidorPendente[]> {
  const { data, error } = await supabase
    .from('cadastros_servidores_pendentes')
    .select('*')
    .eq('status', 'PENDENTE')
    .order('criado_em');
  if (error) throw error;
  return (data ?? []) as CadastroServidorPendente[];
}

export async function aprovarCadastroServidor(cadastroId: string, papel: Papel): Promise<void> {
  const { error } = await supabase.rpc('rpc_aprovar_cadastro_servidor', { p_cadastro_id: cadastroId, p_papel: papel });
  if (error) throw error;
}

export async function rejeitarCadastroServidor(cadastroId: string, observacoes: string): Promise<void> {
  const { error } = await supabase.rpc('rpc_rejeitar_cadastro_servidor', { p_cadastro_id: cadastroId, p_observacoes: observacoes });
  if (error) throw error;
}
