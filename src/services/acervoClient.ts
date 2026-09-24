import { supabase } from '../lib/supabase';

// Banco de questões (ver docs/plano-migracao-banco-questoes.md).
//   LIGADO (padrão desde 2026-09-24): o acervo fica no projeto jbr-acervo-questoes e o portal só
//   fala com ele pela Edge Function `acervo-proxy`, que valida login e papel.
//   Trava de emergência: VITE_ACERVO_EXTERNO=false no build volta a ler/gravar questões direto
//   no banco principal (que ainda guarda a cópia completa até o passo 7 do plano).
export const ACERVO_EXTERNO = import.meta.env.VITE_ACERVO_EXTERNO !== 'false';

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

// Envia uma imagem do editor de questões e devolve a URL pública. Com o acervo externo o arquivo
// vai para o Storage do projeto novo, por uma URL de envio assinada que a Edge Function gera
// (o navegador não tem credencial do outro projeto); sem ele, para o Storage do projeto principal.
export async function enviarImagemQuestao(file: File, pasta: string): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  if (!ACERVO_EXTERNO) {
    const path = `${pasta}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('imagens-questoes').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from('imagens-questoes').getPublicUrl(path).data.publicUrl;
  }
  const { signedUrl, publicUrl } = await acervo<{ signedUrl: string; publicUrl: string }>('urlUploadImagem', { extensao: ext });
  // Mesmo formato que o storage-js usa em uploadToSignedUrl.
  const corpo = new FormData();
  corpo.append('cacheControl', '3600');
  corpo.append('', file);
  const r = await fetch(signedUrl, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: corpo });
  if (!r.ok) {
    const detalhe = await r.json().catch(() => null);
    throw new Error(detalhe?.message ?? `Falha ao enviar a imagem (HTTP ${r.status})`);
  }
  return publicUrl;
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
