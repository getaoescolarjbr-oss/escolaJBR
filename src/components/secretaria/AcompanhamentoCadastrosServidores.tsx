import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Trash2, XCircle } from 'lucide-react';
import {
  listarCadastrosServidores, listarDocumentosDoCadastro, removerRascunhoCadastro,
  type CadastroServidorPendente, type DocumentoDoCadastro,
} from '../../services/cadastroServidorService';
import { formatarTelefone } from '../../utils/cadastroServidor';

const DIAS_PARADO = 30;
const MS_DIA = 86_400_000;
const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / MS_DIA));
const rotuloDias = (d: number) => (d === 0 ? 'hoje' : d === 1 ? 'há 1 dia' : `há ${d} dias`);

// Cadastro devolvido e ainda não reenviado pelo servidor.
const aguardandoCorrecao = (c: CadastroServidorPendente) =>
  Boolean(c.correcao_em) && (!c.enviado_em || new Date(c.enviado_em) < new Date(c.correcao_em as string));

function linkWhatsapp(c: CadastroServidorPendente, mensagem: string) {
  const digitos = c.telefone.replace(/\D/g, '');
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(mensagem)}`;
}

// Última movimentação do rascunho: criação, devolução ou envio do último documento.
function ultimaAtividade(c: CadastroServidorPendente, docs: DocumentoDoCadastro[]): string {
  const datas = [c.criado_em, c.correcao_em, ...docs.map((d) => d.enviado_em)].filter(Boolean) as string[];
  return datas.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
}

// Acompanhamento do que ainda não chegou à fila de análise: cadastros devolvidos para correção,
// cadastros em preenchimento (inclusive parados há muito tempo) e os concluídos recentemente.
export function AcompanhamentoCadastrosServidores() {
  const [rascunhos, setRascunhos] = useState<CadastroServidorPendente[]>([]);
  const [concluidos, setConcluidos] = useState<CadastroServidorPendente[]>([]);
  const [docs, setDocs] = useState<Record<string, DocumentoDoCadastro[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([listarCadastrosServidores(['RASCUNHO']), listarCadastrosServidores(['APROVADO', 'REJEITADO'], 20)]);
      setRascunhos(r);
      setConcluidos(c);
      const todos = await listarDocumentosDoCadastro(r.map((x) => x.id));
      const agrupado: Record<string, DocumentoDoCadastro[]> = {};
      todos.forEach((d) => { (agrupado[d.cadastro_id] ??= []).push(d); });
      setDocs(agrupado);
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

  async function remover(c: CadastroServidorPendente) {
    if (!confirm(`Remover o rascunho de ${c.nome}? Os dados e os documentos enviados serão apagados. A conta de acesso é mantida e ${c.nome.split(' ')[0]} poderá refazer o cadastro ao entrar.`)) return;
    setRemovendoId(c.id);
    setErro(null);
    try {
      await removerRascunhoCadastro(c.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover.');
    } finally {
      setRemovendoId(null);
    }
  }

  if (carregando) return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>;

  const devolvidos = rascunhos.filter(aguardandoCorrecao);
  const emPreenchimento = rascunhos.filter((c) => !aguardandoCorrecao(c));

  const cartao = (c: CadastroServidorPendente, corpo: React.ReactNode, acoes: React.ReactNode) => (
    <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-bold text-ms-main truncate">{c.nome}</p>
        <p className="text-[11px] text-gray-500 truncate">{c.cargo} · {c.email} · {formatarTelefone(c.telefone)}</p>
        {corpo}
      </div>
      <div className="flex items-center gap-1 shrink-0">{acoes}</div>
    </div>
  );

  const botaoZap = (c: CadastroServidorPendente, mensagem: string) => (
    <a href={linkWhatsapp(c, mensagem)} target="_blank" rel="noreferrer" className="p-2 text-green-500 hover:bg-green-500/20 rounded-lg" title="Chamar no WhatsApp">
      <MessageCircle className="w-4 h-4" />
    </a>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {erro && <p className="text-xs text-red-400">{erro}</p>}

      <section className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Devolvidos para correção ({devolvidos.length})</p>
        {devolvidos.length === 0 && <p className="text-sm text-gray-500">Nenhum cadastro aguardando correção.</p>}
        {devolvidos.map((c) => cartao(c,
          <>
            <p className="text-xs text-amber-400">Pedido: {c.correcao_motivo}</p>
            <p className="text-[11px] text-gray-500">Devolvido {rotuloDias(diasDesde(c.correcao_em as string))}</p>
          </>,
          botaoZap(c, `Olá, ${c.nome.split(' ')[0]}! A Secretaria pediu uma correção no seu cadastro de servidor: ${c.correcao_motivo}. Entre no portal, corrija e envie de novo.`),
        ))}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Em preenchimento ({emPreenchimento.length})</p>
        {emPreenchimento.length === 0 && <p className="text-sm text-gray-500">Nenhum cadastro em preenchimento.</p>}
        {emPreenchimento.map((c) => {
          const meus = docs[c.id] ?? [];
          const parado = diasDesde(ultimaAtividade(c, meus));
          return cartao(c,
            <p className="text-[11px] text-gray-500">
              {meus.length} documento{meus.length === 1 ? '' : 's'} enviado{meus.length === 1 ? '' : 's'} · última atividade {rotuloDias(parado)}
              {parado >= DIAS_PARADO && <span className="ml-2 text-amber-400 font-bold">parado</span>}
            </p>,
            <>
              {botaoZap(c, `Olá, ${c.nome.split(' ')[0]}! Seu cadastro de servidor no portal da escola ainda não foi concluído. Entre no portal, envie os documentos e finalize o cadastro.`)}
              <button onClick={() => remover(c)} disabled={removendoId === c.id} className="p-2 text-red-500 hover:bg-red-500/20 rounded-lg disabled:opacity-50" title="Remover rascunho">
                {removendoId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </>,
          );
        })}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Concluídos recentemente</p>
        {concluidos.length === 0 && <p className="text-sm text-gray-500">Nenhum cadastro concluído ainda.</p>}
        {concluidos.map((c) => cartao(c,
          <p className="text-[11px] text-gray-500">
            {c.status === 'APROVADO' ? `Aprovado como ${c.papel_concedido ?? '—'}` : `Rejeitado${c.observacoes_analise ? `: ${c.observacoes_analise}` : ''}`}
            {c.analisado_em ? ` · ${new Date(c.analisado_em).toLocaleDateString('pt-BR')}` : ''}
          </p>,
          c.status === 'APROVADO' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-400" />,
        ))}
      </section>
    </div>
  );
}
