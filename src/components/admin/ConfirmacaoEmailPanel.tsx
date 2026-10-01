import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { definirConfirmacaoEmail, estadoConfirmacaoEmail, type EstadoConfirmacaoEmail } from '../../services/confirmacaoEmailService';

const Passo = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-2 text-xs text-gray-300"><span className="font-black text-ms-blueText">{n}.</span><span>{children}</span></li>
);
const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-ms-blueText underline inline-flex items-center gap-0.5">{children}<ExternalLink className="w-3 h-3" /></a>
);

// Parâmetros Gerais: exigir (ou não) que o novo usuário confirme o e-mail antes de entrar.
// Vale só para contas criadas depois da mudança; quem já tem conta não é afetado.
export function ConfirmacaoEmailPanel() {
  const [estado, setEstado] = useState<EstadoConfirmacaoEmail | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setEstado(await estadoConfirmacaoEmail());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar a configuração.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function alternar() {
    if (!estado) return;
    const ligar = !estado.confirmacaoAtiva;
    const texto = ligar
      ? 'Ligar a confirmação por e-mail? Novos usuários só entram depois de clicar no link enviado ao e-mail deles.'
      : 'Desligar a confirmação por e-mail? Novos usuários entram direto, sem confirmar o e-mail.';
    if (!confirm(texto)) return;
    setSalvando(true);
    setErro(null);
    try {
      setEstado(await definirConfirmacaoEmail(ligar));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const podeLigar = Boolean(estado?.smtpConfigurado);

  return (
    <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ms-main"><MailCheck className="w-4 h-4 text-ms-blueText" /> Confirmação de e-mail no cadastro</h3>
          <p className="text-xs text-gray-400">
            Quando ligada, quem cria uma conta nova precisa clicar no link enviado ao próprio e-mail antes de continuar o cadastro.
            Contas que já existem não são afetadas.
          </p>
        </div>
        <button onClick={carregar} disabled={carregando} className="p-2 text-gray-400 hover:text-ms-main shrink-0" title="Atualizar"><RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} /></button>
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {carregando && !estado ? (
        <Loader2 className="w-5 h-5 animate-spin text-ms-blueText" />
      ) : estado && !estado.tokenConfigurado ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-400">Falta liberar o painel para alterar essa configuração (uma vez só):</p>
          <ol className="space-y-1.5">
            <Passo n={1}>Em <Link href="https://supabase.com/dashboard/account/tokens">supabase.com/dashboard/account/tokens</Link>, clique em <b>Generate new token</b>, dê o nome "portal-jbr" e copie o código (começa com <code>sbp_</code>).</Passo>
            <Passo n={2}>No projeto, abra <b>Edge Functions → Secrets</b> e adicione um segredo chamado <code>MGMT_ACCESS_TOKEN</code> com esse código.</Passo>
            <Passo n={3}>Volte aqui e clique em atualizar (o ícone no canto).</Passo>
          </ol>
          <p className="text-[11px] text-gray-400">O código fica guardado só no Supabase; nunca aparece no portal.</p>
        </div>
      ) : estado ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl">
            <div>
              <p className="text-sm font-bold text-ms-main">{estado.confirmacaoAtiva ? 'Ligada' : 'Desligada'}</p>
              <p className="text-[11px] text-gray-500">{estado.confirmacaoAtiva ? 'Novos usuários confirmam o e-mail antes de entrar.' : 'Novos usuários entram direto.'}</p>
            </div>
            <button
              role="switch" aria-checked={Boolean(estado.confirmacaoAtiva)} onClick={alternar}
              disabled={salvando || (!estado.confirmacaoAtiva && !podeLigar)}
              className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-40 ${estado.confirmacaoAtiva ? 'bg-green-600' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${estado.confirmacaoAtiva ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {!estado.smtpConfigurado && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-amber-400">Para ligar, configure antes o envio de e-mail da escola:</p>
              <p className="text-[11px] text-gray-300">
                O envio padrão do Supabase manda pouquíssimos e-mails por hora e muitos cadastros ficariam sem o link. Crie uma conta gratuita em{' '}
                <Link href="https://resend.com">resend.com</Link>, gere as credenciais SMTP e cole em <b>Authentication → Emails → SMTP Settings</b> no Supabase. Depois atualize esta tela.
              </p>
            </div>
          )}

          <p className="text-[11px] text-gray-500">
            O link do e-mail leva para: <b className="text-gray-300">{estado.siteUrl || 'endereço não informado'}</b>.
            Confira se é o endereço do portal (<b>Authentication → URL Configuration → Site URL</b>).
          </p>
        </div>
      ) : null}
    </div>
  );
}
