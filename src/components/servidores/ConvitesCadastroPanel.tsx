import { useCallback, useEffect, useState } from 'react';
import { Ban, Copy, Link2, Loader2, MessageCircle } from 'lucide-react';
import {
  criarConvite, linkDoConvite, listarCamposConvocacao, listarConvites, revogarConvite, salvarModoCampoConvocacao,
  type CampoConvocacao, type ConviteCadastro, type ModoPreenchimento,
} from '../../services/cadastroServidorService';
import { campoEhData } from '../../utils/cadastroServidor';

const MODOS: { valor: ModoPreenchimento; rotulo: string }[] = [
  { valor: 'SECRETARIA', rotulo: 'Só a Secretaria' },
  { valor: 'PROFESSOR', rotulo: 'Só o servidor' },
  { valor: 'AMBOS', rotulo: 'Os dois' },
];

const classeInput = 'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';

function situacao(c: ConviteCadastro): { texto: string; cor: string; ativo: boolean } {
  if (c.revogado) return { texto: 'Cancelado', cor: 'text-gray-400 border-gray-600/40', ativo: false };
  if (c.usado_em) return { texto: 'Usado', cor: 'text-green-400 border-green-500/30', ativo: false };
  if (new Date(c.expira_em) < new Date()) return { texto: 'Expirado', cor: 'text-red-400 border-red-500/30', ativo: false };
  return { texto: 'Aguardando', cor: 'text-amber-400 border-amber-500/30', ativo: true };
}

// Link de convite para o servidor novo se cadastrar sozinho, já com a convocação combinada: a
// Secretaria define, campo a campo, quem preenche (ela, o servidor ou os dois) e pode adiantar valores.
export function ConvitesCadastroPanel() {
  const [campos, setCampos] = useState<CampoConvocacao[]>([]);
  const [convites, setConvites] = useState<ConviteCadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [modos, setModos] = useState<Record<string, ModoPreenchimento>>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [cs, cv] = await Promise.all([listarCamposConvocacao(), listarConvites()]);
      setCampos(cs);
      setConvites(cv);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function mudarPadrao(c: CampoConvocacao, modo: ModoPreenchimento) {
    setCampos((l) => l.map((x) => (x.id === c.id ? { ...x, modo } : x)));
    try { await salvarModoCampoConvocacao(c.id, modo); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar.'); await carregar(); }
  }

  async function copiar(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      window.prompt('Copie o link:', texto);
      return false;
    }
  }

  async function gerar() {
    setCriando(true);
    setErro(null);
    setMsg(null);
    try {
      // Só vai para o convite o que foge do padrão ou já vem preenchido.
      const dados: ConviteCadastro['campos'] = {};
      campos.forEach((c) => {
        const modo = modos[c.campo] ?? c.modo;
        const valor = (valores[c.campo] ?? '').trim();
        if (modo !== c.modo || valor) dados[c.campo] = { ...(modo !== c.modo ? { modo } : {}), ...(valor ? { valor } : {}) };
      });
      const novo = await criarConvite({ email, nome, campos: dados });
      setEmail(''); setNome(''); setModos({}); setValores({});
      await carregar();
      const copiado = await copiar(linkDoConvite(novo.token));
      setMsg(copiado ? 'Convite criado e link copiado. Envie ao servidor.' : 'Convite criado. Envie o link ao servidor.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar o convite.');
    } finally {
      setCriando(false);
    }
  }

  async function cancelar(c: ConviteCadastro) {
    if (!confirm('Cancelar este convite? O link deixa de funcionar.')) return;
    try { await revogarConvite(c.id); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao cancelar.'); }
  }

  if (carregando) return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-ms-main">Convites de cadastro de servidor</h3>
        <p className="text-xs text-gray-400">
          Gere um link e envie ao servidor. Ele cria o usuário, preenche os dados e anexa os documentos; você só confere. O link vale 14 dias e funciona uma vez.
          Quem não tem convite também pode se cadastrar pela tela de login.
        </p>
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}
      {msg && <p className="text-xs text-green-400">{msg}</p>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo convite</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do servidor (opcional)" className={classeInput} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (opcional — trava o link nesse e-mail)" className={classeInput} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 pt-1">Convocação: quem preenche e o que já adiantar</p>
        <div className="space-y-2">
          {campos.map((c) => (
            <div key={c.id} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_1fr] gap-2 items-center">
              <span className="text-xs text-ms-main font-bold">{c.rotulo}</span>
              <select value={modos[c.campo] ?? c.modo} onChange={(e) => setModos((m) => ({ ...m, [c.campo]: e.target.value as ModoPreenchimento }))} className={classeInput}>
                {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
              </select>
              <input type={campoEhData(c.campo) ? 'date' : 'text'} value={valores[c.campo] ?? ''} onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))} placeholder="Valor (opcional)" className={classeInput} />
            </div>
          ))}
        </div>
        <button onClick={gerar} disabled={criando} className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50">
          {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Gerar link
        </button>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Padrão de quem preenche (usado também no cadastro sem convite)</p>
        <div className="space-y-2">
          {campos.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <span className="text-xs text-ms-main">{c.rotulo}</span>
              <select value={c.modo} onChange={(e) => mudarPadrao(c, e.target.value as ModoPreenchimento)} className={`${classeInput} !w-40`}>
                {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Convites enviados ({convites.length})</p>
        {convites.length === 0 && <p className="text-sm text-gray-500">Nenhum convite ainda.</p>}
        {convites.map((c) => {
          const s = situacao(c);
          const link = linkDoConvite(c.token);
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ms-main truncate">{c.nome || c.email || 'Sem identificação'}</p>
                <p className="text-[11px] text-gray-500">
                  {c.email ? `${c.email} · ` : ''}criado em {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                  {s.ativo && ` · vale até ${new Date(c.expira_em).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${s.cor}`}>{s.texto}</span>
              {s.ativo && (
                <>
                  <button onClick={async () => { if (await copiar(link)) setMsg('Link copiado.'); }} className="p-1.5 text-ms-blueText hover:bg-ms-blue/20 rounded-lg shrink-0" title="Copiar link"><Copy className="w-4 h-4" /></button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Olá! Para fazer seu cadastro de servidor na escola, acesse: ${link}`)}`} target="_blank" rel="noreferrer"
                    className="p-1.5 text-green-500 hover:bg-green-500/20 rounded-lg shrink-0" title="Enviar por WhatsApp"><MessageCircle className="w-4 h-4" /></a>
                  <button onClick={() => cancelar(c)} className="p-1.5 text-red-500 hover:bg-red-500/20 rounded-lg shrink-0" title="Cancelar convite"><Ban className="w-4 h-4" /></button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
