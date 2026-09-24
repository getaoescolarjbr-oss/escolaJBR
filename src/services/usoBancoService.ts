import { supabase } from '../lib/supabase';

export interface UsoBancoDados {
  total_bytes: number;
  storage_bytes: number;
  public_bytes: number;
  maiores_tabelas: { tabela: string; bytes: number }[];
}

// Cotas do plano gratuito do Supabase (por projeto). Se o plano mudar, é só editar aqui.
export const LIMITE_BANCO_BYTES = 500 * 1024 * 1024;
export const LIMITE_STORAGE_BYTES = 1024 * 1024 * 1024;

// Só a GESTAO consegue chamar (a checagem é dentro da função no banco).
export async function obterUsoBancoDados(): Promise<UsoBancoDados> {
  const { data, error } = await supabase.rpc('rpc_uso_banco_dados');
  if (error) throw new Error(error.message);
  return data as UsoBancoDados;
}

// Uso do segundo projeto (jbr-acervo-questoes, banco de questões). O navegador não fala com
// ele direto: passa pela Edge Function `acervo-proxy`, que valida o login e só deixa a
// GESTAO consultar (mesma ponte do banco de questões).
export async function obterUsoBancoAcervo(): Promise<UsoBancoDados> {
  const { data, error } = await supabase.functions.invoke('acervo-proxy', { body: { op: 'usoBanco', args: {} } });
  if (error) {
    // FunctionsHttpError traz a resposta original; a mensagem útil vem em { erro }.
    let mensagem = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const corpo = await ctx.json();
        if (corpo?.erro) mensagem = corpo.erro;
      } catch { /* mantém a mensagem genérica */ }
    }
    throw new Error(mensagem);
  }
  return (data as { data: UsoBancoDados }).data;
}
