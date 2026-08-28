import { useEffect, useState } from 'react';
import { Loader2, Plus, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import type { CategoriaChamado, PrioridadeChamado, StatusChamado, HistoricoChamado } from '../../../types/manutencao';
import type { ChamadoDetalhado } from '../../../services/manutencaoService';
import {
  listarChamados,
  criarChamado,
  atualizarChamado,
  listarHistorico,
  listarServidoresParaDesignar,
} from '../../../services/manutencaoService';
import type { BemPatrimonial } from '../../../types/patrimonio';
import { listarBens } from '../../../services/patrimonioService';

const CATEGORIAS: CategoriaChamado[] = ['ELETRICA', 'HIDRAULICA', 'ESTRUTURA', 'MOBILIARIO', 'OUTRO'];
const PRIORIDADES: PrioridadeChamado[] = ['BAIXA', 'MEDIA', 'ALTA'];
const STATUS_FILTROS: { id: StatusChamado | 'TODOS'; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'ABERTO', label: 'Abertos' },
  { id: 'EM_ANDAMENTO', label: 'Em andamento' },
  { id: 'CONCLUIDO', label: 'Concluídos' },
  { id: 'CANCELADO', label: 'Cancelados' },
];

const STATUS_LABEL: Record<StatusChamado, string> = { ABERTO: 'Aberto', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
const STATUS_COR: Record<StatusChamado, string> = {
  ABERTO: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  EM_ANDAMENTO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  CONCLUIDO: 'bg-green-500/10 text-green-500 border-green-500/20',
  CANCELADO: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};
const PRIORIDADE_COR: Record<PrioridadeChamado, string> = {
  BAIXA: 'text-gray-400',
  MEDIA: 'text-amber-400',
  ALTA: 'text-red-400',
};

export function ManutencaoPanel() {
  const { usuarioId, hasRole } = useAuth();
  const podeGerir = hasRole('GESTAO');

  const [chamados, setChamados] = useState<ChamadoDetalhado[]>([]);
  const [servidores, setServidores] = useState<{ user_id: string; nome: string }[]>([]);
  const [filtro, setFiltro] = useState<StatusChamado | 'TODOS'>('TODOS');
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Record<string, HistoricoChamado[]>>({});

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<CategoriaChamado>('ELETRICA');
  const [local, setLocal] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeChamado>('MEDIA');
  const [bemPatrimonialId, setBemPatrimonialId] = useState('');
  const [bens, setBens] = useState<BemPatrimonial[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [lista, servidoresLista, bensLista] = await Promise.all([
        listarChamados(filtro === 'TODOS' ? undefined : filtro),
        podeGerir ? listarServidoresParaDesignar() : Promise.resolve([]),
        listarBens(),
      ]);
      setChamados(lista);
      setServidores(servidoresLista);
      setBens(bensLista);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function handleAbrirChamado() {
    if (!titulo.trim() || !local.trim() || !usuarioId) {
      setErro('Informe o título e o local.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await criarChamado({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        categoria,
        local: local.trim(),
        prioridade,
        aberto_por: usuarioId,
        bem_patrimonial_id: bemPatrimonialId || null,
      });
      setTitulo('');
      setDescricao('');
      setLocal('');
      setPrioridade('MEDIA');
      setBemPatrimonialId('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir chamado.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExpandir(chamadoId: string) {
    if (expandido === chamadoId) {
      setExpandido(null);
      return;
    }
    setExpandido(chamadoId);
    if (!historico[chamadoId]) {
      const h = await listarHistorico(chamadoId);
      setHistorico((s) => ({ ...s, [chamadoId]: h }));
    }
  }

  async function handleMudarStatus(chamadoId: string, status: StatusChamado) {
    await atualizarChamado(chamadoId, { status });
    await carregar();
    setHistorico((s) => { const novo = { ...s }; delete novo[chamadoId]; return novo; });
  }

  async function handleDesignar(chamadoId: string, responsavelId: string) {
    await atualizarChamado(chamadoId, { responsavel_id: responsavelId || null });
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Abrir chamado</p>
        <input placeholder="Título (ex.: Lâmpada queimada na sala 12)" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue resize-none" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input placeholder="Local" value={local} onChange={(e) => setLocal(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaChamado)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeChamado)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <select value={bemPatrimonialId} onChange={(e) => setBemPatrimonialId(e.target.value)} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
          <option value="">Bem patrimonial relacionado (opcional)</option>
          {bens.map((b) => <option key={b.id} value={b.id}>{b.nome} (#{b.numero_patrimonio})</option>)}
        </select>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <button onClick={handleAbrirChamado} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Abrir chamado
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filtro === f.id ? 'bg-ms-blue text-white' : 'bg-ms-dark text-gray-400 border border-gray-800'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
        ) : chamados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum chamado encontrado.</p>
        ) : (
          chamados.map((c) => (
            <div key={c.id} className="bg-ms-card border border-gray-800 rounded-xl">
              <button onClick={() => handleExpandir(c.id)} className="w-full flex items-center justify-between px-4 py-3">
                <div className="text-left">
                  <p className="text-sm font-bold text-ms-main">{c.titulo}</p>
                  <p className="text-[10px] text-gray-500">
                    {c.local} · {c.categoria} · <span className={PRIORIDADE_COR[c.prioridade]}>{c.prioridade}</span> · aberto por {c.aberto_por_nome}
                    {c.responsavel_nome && ` · designado: ${c.responsavel_nome}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-black ${STATUS_COR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                  {expandido === c.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </button>

              {expandido === c.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                  {c.descricao && <p className="text-xs text-gray-400">{c.descricao}</p>}

                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Histórico</p>
                    {(historico[c.id] ?? []).map((h) => (
                      <p key={h.id} className="text-[11px] text-gray-500">
                        {new Date(h.alterado_em).toLocaleString('pt-BR')} — {h.status_anterior ? `${STATUS_LABEL[h.status_anterior]} → ` : 'criado como '}{STATUS_LABEL[h.status_novo]}
                      </p>
                    ))}
                  </div>

                  {podeGerir && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      <select
                        value={c.status}
                        onChange={(e) => handleMudarStatus(c.id, e.target.value as StatusChamado)}
                        className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                      >
                        {(['ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO'] as StatusChamado[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      <select
                        value={c.responsavel_id ?? ''}
                        onChange={(e) => handleDesignar(c.id, e.target.value)}
                        className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                      >
                        <option value="">Sem responsável designado</option>
                        {servidores.map((s) => <option key={s.user_id} value={s.user_id}>{s.nome}</option>)}
                      </select>
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
