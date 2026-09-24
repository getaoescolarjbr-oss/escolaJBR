// Polling que não trabalha à toa: pausa enquanto a aba está oculta (o navegador já
// throttle timers em segundo plano, mas a requisição ao banco seguia saindo) e faz uma
// atualização imediata quando o usuário volta para a aba. Devolve a função de limpeza,
// pronta para o `return` de um useEffect.
export function iniciarPolling(atualizar: () => void, intervaloMs: number): () => void {
  const id = setInterval(() => {
    if (!document.hidden) atualizar();
  }, intervaloMs);
  const aoVoltar = () => {
    if (!document.hidden) atualizar();
  };
  document.addEventListener('visibilitychange', aoVoltar);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', aoVoltar);
  };
}
