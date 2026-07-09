import { useEffect, useState } from 'react';
import { Loader2, Trash2, Send, Search } from 'lucide-react';
import type { MaterialComSaldo, Requisicao } from '../../../types/almoxarifado';
import { listarMateriaisComSaldo, criarRequisicao, listarMinhasRequisicoes, listarItensRequisicao } from '../../../services/almoxarifadoService';

const STATUS_LABEL: Record<string, string> = { PENDENTE: 'Pendente', ATENDIDA: 'Atendida', RECUSADA: 'Recusada' };
const STATUS_COR: Record<string, string> = {
  PENDENTE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  ATENDIDA: 'bg-green-500/10 text-green-500 border-green-500/20',
  RECUSADA: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface ItemCarrinho {
  material: MaterialComSaldo;
  quantidade: number;
}

export function RequisitarTab() {
  const [materiais, setMateriais] = useState<MaterialComSaldo[]>([]);
  const [minhasRequisicoes, setMinhasRequisicoes] = useState<Requisicao[]>([]);
  const [itensExpandidos, setItensExpandidos] = useState<Record<string, { material_nome: string; quantidade_solicitada: number; quantidade_atendida: number | null }[]>>({});
  const [loading, setLoading] = useState(true);

  const [setor, setSetor] = useState('');
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [m, r] = await Promise.all([listarMateriaisComSaldo(), listarMinhasRequisicoes()]);
      setMateriais(m.filter((x) => x.ativo));
      setMinhasRequisicoes(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  const resultadosBusca = busca.trim().length >= 2
    ? materiais.filter((m) => m.nome.toLowerCase().includes(busca.toLowerCase()) && !carrinho.some((c) => c.material.id === m.id))
    : [];

  function adicionarAoCarrinho(material: MaterialComSaldo) {
    setCarrinho((c) => [...c, { material, quantidade: 1 }]);
    setBusca('');
  }

  function removerDoCarrinho(materialId: string) {
    setCarrinho((c) => c.filter((i) => i.material.id !== materialId));
  }

  function atualizarQuantidade(materialId: string, quantidade: number) {
    setCarrinho((c) => c.map((i) => (i.material.id === materialId ? { ...i, quantidade } : i)));
  }

  async function handleEnviar() {
    if (!setor.trim() || carrinho.length === 0) {
      setErro('Informe o setor e adicione ao menos um item.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await criarRequisicao(setor.trim(), carrinho.map((i) => ({ material_id: i.material.id, quantidade: i.quantidade })));
      setSetor('');
      setCarrinho([]);
      setMensagem('Requisição enviada! Aguarde a aprovação da Gestão/Secretaria.');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar requisição.');
    } finally {
      setEnviando(false);
    }
  }

  async function handleExpandir(requisicaoId: string) {
    if (itensExpandidos[requisicaoId]) {
      setItensExpandidos((s) => { const novo = { ...s }; delete novo[requisicaoId]; return novo; });
      return;
    }
    const itens = await listarItensRequisicao(requisicaoId);
    setItensExpandidos((s) => ({ ...s, [requisicaoId]: itens }));
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Nova requisição de material</p>
        <input
          placeholder="Setor solicitante (ex.: Sala de Recursos, Secretaria...)"
          value={setor}
          onChange={(e) => setSetor(e.target.value)}
          className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
        />

        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Buscar material (papel, caneta, detergente...)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
          {resultadosBusca.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-ms-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl max-h-56 overflow-y-auto">
              {resultadosBusca.map((m) => (
                <button key={m.id} onClick={() => adicionarAoCarrinho(m)} className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-card">
                  {m.nome} <span className="text-[10px] text-gray-500">({m.unidade} · saldo: {m.saldo})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {carrinho.length > 0 && (
          <div className="space-y-2">
            {carrinho.map((item) => (
              <div key={item.material.id} className="flex items-center justify-between px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl">
                <span className="text-sm text-ms-main">{item.material.nome}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => atualizarQuantidade(item.material.id, Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-ms-card border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                  />
                  <span className="text-[10px] text-gray-500">{item.material.unidade}</span>
                  <button onClick={() => removerDoCarrinho(item.material.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {erro && <p className="text-xs text-red-400">{erro}</p>}
        {mensagem && <p className="text-xs text-green-500">{mensagem}</p>}
        <button onClick={handleEnviar} disabled={enviando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar requisição
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Minhas requisições</p>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : minhasRequisicoes.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma requisição ainda.</p>
        ) : (
          minhasRequisicoes.map((r) => (
            <div key={r.id} className="bg-ms-card border border-gray-800 rounded-xl">
              <button onClick={() => handleExpandir(r.id)} className="w-full flex items-center justify-between px-4 py-3">
                <div className="text-left">
                  <p className="text-sm font-bold text-ms-main">{r.setor}</p>
                  <p className="text-[10px] text-gray-500">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-black ${STATUS_COR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </button>
              {itensExpandidos[r.id] && (
                <div className="px-4 pb-3 space-y-1 border-t border-gray-800 pt-2">
                  {itensExpandidos[r.id].map((item, idx) => (
                    <p key={idx} className="text-xs text-gray-400">
                      {item.material_nome}: {item.quantidade_atendida ?? '—'} / {item.quantidade_solicitada} solicitado(s)
                    </p>
                  ))}
                  {r.status === 'RECUSADA' && r.observacao_recusa && <p className="text-xs text-red-400">Motivo: {r.observacao_recusa}</p>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
