import { supabase } from '../lib/supabase';

// Confirmação de e-mail no cadastro de novos usuários. A configuração mora no Supabase Auth e é
// alterada pela Edge Function auth-confirmacao-email (só GESTAO), que guarda o token de gerenciamento.
export interface EstadoConfirmacaoEmail {
  tokenConfigurado: boolean;
  confirmacaoAtiva?: boolean; // true = o novo usuário precisa confirmar o e-mail antes de entrar
  smtpConfigurado?: boolean; // servidor de e-mail próprio (o padrão do Supabase só envia poucos e-mails por hora)
  siteUrl?: string | null; // para onde o link do e-mail leva
}

async function chamar(body: { op: 'status' } | { op: 'definir'; ativo: boolean }): Promise<EstadoConfirmacaoEmail> {
  const { data, error } = await supabase.functions.invoke('auth-confirmacao-email', { body });
  if (error) {
    // A mensagem útil vem no corpo da resposta ({ erro }), não em error.message.
    const resposta = (error as { context?: Response }).context;
    const corpo = resposta && typeof resposta.json === 'function' ? await resposta.json().catch(() => null) : null;
    throw new Error(corpo?.erro ?? error.message);
  }
  return data as EstadoConfirmacaoEmail;
}

export const estadoConfirmacaoEmail = () => chamar({ op: 'status' });
export const definirConfirmacaoEmail = (ativo: boolean) => chamar({ op: 'definir', ativo });
