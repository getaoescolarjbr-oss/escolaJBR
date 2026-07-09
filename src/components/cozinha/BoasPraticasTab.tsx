import { useEffect, useState } from 'react';
import { Loader2, Plus, CheckCircle2, XCircle, FileText, Upload, ClipboardCheck, Building2, ThumbsUp } from 'lucide-react';
import { SectionIcon } from '../ui/SectionIcon';
import { useAuth } from '../../hooks/useAuth';
import type { ControleSanitario, InspecaoSanitaria, TesteAceitabilidade, TipoControleSanitario, FichaTecnica } from '../../types/cozinha';
import {
  listarControleSanitario,
  criarControleSanitario,
  listarInspecoesSanitarias,
  criarInspecaoSanitaria,
  enviarArquivoInspecaoSanitaria,
  obterUrlInspecaoSanitaria,
  listarTestesAceitabilidade,
  criarTesteAceitabilidade,
  listarFichasTecnicas,
} from '../../services/cozinhaService';

const ROTULOS_TIPO_CONTROLE: Record<TipoControleSanitario, string> = {
  HIGIENE: 'Higiene',
  TEMPERATURA: 'Temperatura',
  LIMPEZA: 'Limpeza',
};

export function BoasPraticasTab() {
  const { usuarioId } = useAuth();
  const [controles, setControles] = useState<ControleSanitario[]>([]);
  const [inspecoes, setInspecoes] = useState<InspecaoSanitaria[]>([]);
  const [testes, setTestes] = useState<TesteAceitabilidade[]>([]);
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState<string | null>(null);

  const [novoControle, setNovoControle] = useState({ tipo: 'HIGIENE' as TipoControleSanitario, item: '', conforme: true, observacoes: '' });
  const [novaInspecao, setNovaInspecao] = useState({ data: new Date().toISOString().slice(0, 10), orgao: '', resultado: '' });
  const [novoTeste, setNovoTeste] = useState({ ficha_id: '', metodo: '', percentual_aceitacao: '' });

  async function carregar() {
    setLoading(true);
    try {
      const [c, i, t, f] = await Promise.all([listarControleSanitario(), listarInspecoesSanitarias(), listarTestesAceitabilidade(), listarFichasTecnicas()]);
      setControles(c);
      setInspecoes(i);
      setTestes(t);
      setFichas(f);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriarControle() {
    if (!usuarioId) return;
    setErro(null);
    try {
      await criarControleSanitario({
        data: new Date().toISOString().slice(0, 10),
        tipo: novoControle.tipo,
        itens: novoControle.item ? [{ item: novoControle.item, ok: novoControle.conforme }] : [],
        conforme: novoControle.conforme,
        responsavel: usuarioId,
        observacoes: novoControle.observacoes || null,
      });
      setNovoControle({ tipo: 'HIGIENE', item: '', conforme: true, observacoes: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar controle sanitário.');
    }
  }

  async function handleCriarInspecao() {
    if (!novaInspecao.orgao || !novaInspecao.resultado || !usuarioId) {
      setErro('Preencha órgão e resultado da inspeção.');
      return;
    }
    setErro(null);
    try {
      await criarInspecaoSanitaria({ data: novaInspecao.data, orgao: novaInspecao.orgao, resultado: novaInspecao.resultado, registrado_por: usuarioId });
      setNovaInspecao({ data: new Date().toISOString().slice(0, 10), orgao: '', resultado: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar inspeção.');
    }
  }

  async function handleAnexarInspecao(inspecaoId: string, arquivo: File) {
    setEnviandoArquivo(inspecaoId);
    setErro(null);
    try {
      await enviarArquivoInspecaoSanitaria(inspecaoId, arquivo);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao anexar arquivo.');
    } finally {
      setEnviandoArquivo(null);
    }
  }

  async function handleVerArquivoInspecao(inspecao: InspecaoSanitaria) {
    try {
      const url = await obterUrlInspecaoSanitaria(inspecao);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir arquivo.');
    }
  }

  async function handleCriarTeste() {
    if (!novoTeste.ficha_id || !novoTeste.metodo || !novoTeste.percentual_aceitacao || !usuarioId) {
      setErro('Selecione a preparação, o método e o percentual de aceitação.');
      return;
    }
    setErro(null);
    try {
      await criarTesteAceitabilidade({
        ficha_id: novoTeste.ficha_id,
        cardapio_id: null,
        metodo: novoTeste.metodo,
        data: new Date().toISOString().slice(0, 10),
        percentual_aceitacao: Number(novoTeste.percentual_aceitacao),
        registrado_por: usuarioId,
      });
      setNovoTeste({ ficha_id: '', metodo: '', percentual_aceitacao: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar teste de aceitabilidade.');
    }
  }

  function nomeFicha(fichaId: string | null) {
    return fichas.find((f) => f.id === fichaId)?.preparacao ?? '—';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={ClipboardCheck} cor="teal" /> Registrar controle sanitário</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={novoControle.tipo} onChange={(e) => setNovoControle({ ...novoControle, tipo: e.target.value as TipoControleSanitario })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_TIPO_CONTROLE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <input placeholder="Item verificado" value={novoControle.item} onChange={(e) => setNovoControle({ ...novoControle, item: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={novoControle.conforme ? '1' : '0'} onChange={(e) => setNovoControle({ ...novoControle, conforme: e.target.value === '1' })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="1">Conforme</option>
            <option value="0">Não conforme</option>
          </select>
        </div>
        <input placeholder="Observações (opcional)" value={novoControle.observacoes} onChange={(e) => setNovoControle({ ...novoControle, observacoes: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <button onClick={handleCriarControle} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Registrar
        </button>
        <div className="space-y-1.5 pt-2">
          {controles.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm px-3 py-2 bg-ms-dark rounded-lg border border-gray-800">
              <span className="text-gray-300">{ROTULOS_TIPO_CONTROLE[c.tipo]} — {new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              {c.conforme ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={Building2} cor="blue" /> Inspeção sanitária (guarda de 5 anos)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="date" value={novaInspecao.data} onChange={(e) => setNovaInspecao({ ...novaInspecao, data: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Órgão fiscalizador" value={novaInspecao.orgao} onChange={(e) => setNovaInspecao({ ...novaInspecao, orgao: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Resultado" value={novaInspecao.resultado} onChange={(e) => setNovaInspecao({ ...novaInspecao, resultado: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <button onClick={handleCriarInspecao} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Registrar inspeção
        </button>
        <div className="space-y-1.5 pt-2">
          {inspecoes.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-sm px-3 py-2 bg-ms-dark rounded-lg border border-gray-800">
              <span className="text-gray-300">{i.orgao} — {new Date(i.data + 'T12:00:00').toLocaleDateString('pt-BR')} — {i.resultado}</span>
              {i.arquivo_path ? (
                <button onClick={() => handleVerArquivoInspecao(i)} className="flex items-center gap-1 text-xs font-bold text-ms-blue hover:text-blue-400"><FileText className="w-3.5 h-3.5" /> Ver arquivo</button>
              ) : (
                <label className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-200 cursor-pointer">
                  {enviandoArquivo === i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Anexar
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAnexarInspecao(i.id, f); }} />
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={ThumbsUp} cor="emerald" /> Teste de aceitabilidade</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={novoTeste.ficha_id} onChange={(e) => setNovoTeste({ ...novoTeste, ficha_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Preparação...</option>
            {fichas.map((f) => <option key={f.id} value={f.id}>{f.preparacao}</option>)}
          </select>
          <input placeholder="Método (ex.: escala hedônica)" value={novoTeste.metodo} onChange={(e) => setNovoTeste({ ...novoTeste, metodo: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="number" step="0.1" min="0" max="100" placeholder="% de aceitação" value={novoTeste.percentual_aceitacao} onChange={(e) => setNovoTeste({ ...novoTeste, percentual_aceitacao: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <button onClick={handleCriarTeste} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Registrar teste
        </button>
        <div className="space-y-1.5 pt-2">
          {testes.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm px-3 py-2 bg-ms-dark rounded-lg border border-gray-800">
              <span className="text-gray-300">{nomeFicha(t.ficha_id)} — {t.metodo}</span>
              <span className={`font-black ${t.percentual_aceitacao >= 85 ? 'text-green-500' : t.percentual_aceitacao >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{t.percentual_aceitacao}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
