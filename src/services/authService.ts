import { supabase } from '../lib/supabase';
import type { Papel, UsuarioPapel } from '../types/rbac';

// Camada fina sobre supabase.auth. Objetivo: nenhuma tela chama supabase.auth.*
// diretamente, então adicionar login federado (ex.: gov.br) no futuro é mudar só
// este arquivo, não reescrever Login.tsx nem o restante do app.

export function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function registerFirstAccess(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
}

export function signOut() {
  return supabase.auth.signOut();
}

export async function atualizarSenha(novaSenha: string) {
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
}

// Login federado (preparado, ainda não usado): quando um provedor OIDC (ex.: gov.br
// via SSO customizado do Supabase Auth) estiver configurado no painel do Supabase,
// basta chamar signInWithFederatedProvider('<provider_id>'). O restante do app não
// precisa mudar: useAuth() já reage a qualquer sessão que o Supabase Auth criar,
// independente de ter vindo de senha ou de um provedor federado.
export function signInWithFederatedProvider(providerId: string) {
  return supabase.auth.signInWithOAuth({ provider: providerId as never });
}

// Papéis do usuário logado (RLS permite: usuario_papeis.usuario_id = auth.uid()).
export async function fetchMeusPapeis(usuarioId: string): Promise<Papel[]> {
  const { data, error } = await supabase
    .from('usuario_papeis')
    .select('papel')
    .eq('usuario_id', usuarioId);

  if (error || !data) return [];
  return data.map((row) => row.papel as Papel);
}

// Só GESTAO consegue de fato executar estas RPCs — a validação real acontece no
// banco (rpc_atribuir_papel/rpc_revogar_papel/rpc_listar_usuarios_papeis já checam
// usuario_tem_papel('GESTAO') antes de qualquer escrita ou leitura ampla).
export async function atribuirPapel(usuarioId: string, papel: Papel) {
  const { error } = await supabase.rpc('rpc_atribuir_papel', {
    p_usuario_id: usuarioId,
    p_papel: papel,
  });
  if (error) throw error;
}

export async function revogarPapel(usuarioId: string, papel: Papel) {
  const { error } = await supabase.rpc('rpc_revogar_papel', {
    p_usuario_id: usuarioId,
    p_papel: papel,
  });
  if (error) throw error;
}

export async function listarUsuariosPapeis(): Promise<UsuarioPapel[]> {
  const { data, error } = await supabase.rpc('rpc_listar_usuarios_papeis');
  if (error) throw error;
  return (data ?? []) as UsuarioPapel[];
}
