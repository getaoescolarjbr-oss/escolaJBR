import { supabase } from '../lib/supabase';

// Chave de migração do banco de questões (ver docs/plano-migracao-banco-questoes.md).
//   desligada (padrão): o portal lê e grava questões direto no banco principal, como sempre.
//   ligada (VITE_ACERVO_EXTERNO=true no build): o acervo fica no projeto jbr-acervo-questoes e
//   o portal só fala com ele pela Edge Function `acervo-proxy`, que valida login e papel.
export const ACERVO_EXTERNO = import.meta.env.VITE_ACERVO_EXTERNO === 'true';

export async function acervo<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('acervo-proxy', { body: { op, args } });
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
  return (data as { data: T }).data;
}

// As funções de prova/correção/simulado só conhecem questões que existem no banco principal
// (chave estrangeira). Com o acervo externo, toda questão precisa ser copiada para cá ANTES de
// entrar numa prova. É idempotente e nunca sobrescreve uma questão já importada. Sem a chave
// ligada não faz nada.
export async function garantirQuestoesNoPrincipal(ids: string[]): Promise<void> {
  if (!ACERVO_EXTERNO || ids.length === 0) return;
  const r = await acervo<{ importadas: number; ausentes: string[] }>('importar', { ids });
  if (r.ausentes.length > 0) {
    throw new Error(`Algumas questões não foram encontradas no acervo (${r.ausentes.length}). Atualize a lista e tente de novo.`);
  }
}
