// A cada deploy os arquivos de cada tela ganham nomes novos (hash no nome). Quem estava com a aba
// aberta de antes do deploy pede um arquivo que não existe mais, o carregamento falha e a tela
// ficava branca até atualizar a página. Aqui a página se atualiza sozinha, uma vez.
const CHAVE = 'portal-recarga-por-versao';
const INTERVALO_MS = 30_000;

// true = a página vai recarregar agora. false = já recarregou há pouco (ou não há como saber):
// quem chamou deve mostrar o erro em vez de recarregar de novo, para nunca entrar em loop.
export function recarregarSeChunkAntigo(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
    if (Date.now() - ultima < INTERVALO_MS) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
