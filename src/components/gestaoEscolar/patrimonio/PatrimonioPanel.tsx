import { useEffect, useState } from 'react';
import { Loader2, Plus, Boxes, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import type { CategoriaBem, SituacaoBem, HistoricoBemPatrimonial } from '../../../types/patrimonio';
import type { BemPatrimonial } from '../../../types/patrimonio';
import { listarBens, criarBem, atualizarBem, listarHistoricoBem } from '../../../services/patrimonioService';

const CATEGORIAS: CategoriaBem[] = ['MOBILIARIO', 'EQUIPAMENTO_ELETRONICO', 'ELETRODOMESTICO', 'VEICULO', 'OUTRO'];
const SITUACOES: SituacaoBem[] = ['EM_USO', 'EM_MANUTENCAO', 'BAIXADO', 'EXTRAVIADO'];

const SITUACAO_LABEL: Record<SituacaoBem, string> = { EM_USO: 'Em uso', EM_MANUTENCAO: 'Em manutenção', BAIXADO: 'Baixado', EXTRAVIADO: 'Extraviado' };
const SITUACAO_COR: Record<SituacaoBem, string> = {
  EM_USO: 'bg-green-500/10 text-green-500 border-green-500/20',
  EM_MANUTENCAO: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  BAIXADO: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  EXTRAVIADO: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export function PatrimonioPanel() {
  const { usuarioId, hasAnyRole } = useAuth();
  const podeGerir = hasAnyRole(['GESTAO', 'SECRETARIA']);

  const [bens, setBens] = useState<BemPatrimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Record<string, HistoricoBemPatrimonial[]>>({});

  const [numeroPatrimonio, setNumeroPatrimonio] = useState('');
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaBem>('MOBILIARIO');
  const [localAtual, setLocalAtual] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      setBens(await listarBens());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriar() {
    if (!numeroPatrimonio.trim() || !nome.trim() || !localAtual.trim() || !usuarioId) {
      setErro('Informe nº de patrimônio, nome e local.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarBem({
        numero_patrimonio: numeroPatrimonio.trim(),
        nome: nome.trim(),
        descricao: null,
        categoria,
        local_atual: localAtual.trim(),
        data_aquisicao: null,
        valor_aquisicao: null,
        fonte_recurso: null,
        criado_por: usuarioId,
      });
      setNumeroPatrimonio('');
      setNome('');
      setLocalAtual('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar bem. O nº de patrimônio pode já existir.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExpandir(bemId: string) {
    if (expandido === bemId) {
      setExpandido(null);
      return;
    }
    setExpandido(bemId);
    if (!historico[bemId]) {
      const h = await listarHistoricoBem(bemId);
      setHistorico((s) => ({ ...s, [bemId]: h }));
    }
  }

  async function handleMudarSituacao(bemId: string, situacao: SituacaoBem) {
    await atualizarBem(bemId, { situacao });
    await carregar();
    setHistorico((s) => { const novo = { ...s }; delete novo[bemId]; return novo; });
  }

  async function handleMudarLocal(bemId: string, local: string) {
    if (!local.trim()) return;
    await atualizarBem(bemId, { local_atual: local.trim() });
    await carregar();
    setHistorico((s) => { const novo = { ...s }; delete novo[bemId]; return novo; });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {podeGerir && (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-1"><Boxes className="w-3.5 h-3.5" /> Cadastrar bem</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nº de patrimônio (tombamento)" value={numeroPatrimonio} onChange={(e) => setNumeroPatrimonio(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <input placeholder="Nome do bem" value={nome} onChange={(e) => setNome(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaBem)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Local atual" value={localAtual} onChange={(e) => setLocalAtual(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          </div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <button onClick={handleCriar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Cadastrar
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Bens cadastrados ({bens.length})</p>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : bens.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum bem cadastrado ainda.</p>
        ) : (
          bens.map((b) => (
            <div key={b.id} className="bg-ms-card border border-gray-800 rounded-xl">
              <button onClick={() => handleExpandir(b.id)} className="w-full flex items-center justify-between px-4 py-3">
                <div className="text-left">
                  <p className="text-sm font-bold text-ms-main">{b.nome} <span className="text-[10px] text-gray-500 font-mono">#{b.numero_patrimonio}</span></p>
                  <p className="text-[10px] text-gray-500">{b.categoria} · {b.local_atual}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-black ${SITUACAO_COR[b.situacao]}`}>{SITUACAO_LABEL[b.situacao]}</span>
                  {expandido === b.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </button>

              {expandido === b.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Histórico</p>
                    {(historico[b.id] ?? []).map((h) => (
                      <p key={h.id} className="text-[11px] text-gray-500">
                        {new Date(h.alterado_em).toLocaleString('pt-BR')} — {h.campo === 'CRIACAO' ? `cadastrado (${h.valor_novo})` : `${h.campo === 'SITUACAO' ? 'situação' : 'local'}: ${h.valor_anterior} → ${h.valor_novo}`}
                      </p>
                    ))}
                  </div>

                  {podeGerir && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      <select
                        value={b.situacao}
                        onChange={(e) => handleMudarSituacao(b.id, e.target.value as SituacaoBem)}
                        className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                      >
                        {SITUACOES.map((s) => <option key={s} value={s}>{SITUACAO_LABEL[s]}</option>)}
                      </select>
                      <input
                        placeholder="Novo local"
                        defaultValue=""
                        onKeyDown={(e) => { if (e.key === 'Enter') handleMudarLocal(b.id, e.currentTarget.value); }}
                        className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
