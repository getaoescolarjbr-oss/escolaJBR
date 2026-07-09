import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { EstoqueItem, Cardapio, CardapioItem, Turno, Nutricionista } from '../../types/cozinha';
import {
  listarItensEstoque,
  listarCardapios,
  criarCardapio,
  atualizarCardapio,
  listarItensCardapio,
  adicionarItemCardapio,
  removerItemCardapio,
  obterRefeicaoServida,
  registrarRefeicaoServida,
  listarNutricionistas,
} from '../../services/cozinhaService';

function inicioSemana(): string {
  const hoje = new Date();
  return hoje.toISOString().slice(0, 10);
}

function fimSemana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function CardapioTab() {
  const { usuarioId } = useAuth();
  const [itensEstoque, setItensEstoque] = useState<EstoqueItem[]>([]);
  const [cardapios, setCardapios] = useState<Cardapio[]>([]);
  const [nutricionistas, setNutricionistas] = useState<Nutricionista[]>([]);
  const [itensPorCardapio, setItensPorCardapio] = useState<Record<string, CardapioItem[]>>({});
  const [refeicoesPorCardapio, setRefeicoesPorCardapio] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [novaData, setNovaData] = useState(new Date().toISOString().slice(0, 10));
  const [novoTurno, setNovoTurno] = useState<Turno>('Matutino');
  const [erro, setErro] = useState<string | null>(null);
  const [novoItemPorCardapio, setNovoItemPorCardapio] = useState<Record<string, { item_id: string; descricao: string; quantidade: string }>>({});
  const [quantidadeAlunos, setQuantidadeAlunos] = useState<Record<string, string>>({});
  const [rtPorCardapio, setRtPorCardapio] = useState<Record<string, string>>({});

  async function carregar() {
    setLoading(true);
    try {
      const [itens, listaCardapios, listaNutricionistas] = await Promise.all([listarItensEstoque(), listarCardapios(inicioSemana(), fimSemana()), listarNutricionistas()]);
      setItensEstoque(itens);
      setCardapios(listaCardapios);
      setNutricionistas(listaNutricionistas);

      const itensMap: Record<string, CardapioItem[]> = {};
      const refeicoesMap: Record<string, number> = {};
      for (const c of listaCardapios) {
        itensMap[c.id] = await listarItensCardapio(c.id);
        const refeicao = await obterRefeicaoServida(c.id);
        if (refeicao) refeicoesMap[c.id] = refeicao.quantidade_alunos;
      }
      setItensPorCardapio(itensMap);
      setRefeicoesPorCardapio(refeicoesMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriarCardapio() {
    setErro(null);
    try {
      await criarCardapio({ data: novaData, turno: novoTurno, nutricionista_pessoa_id: null });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar cardápio (verifique se já existe um para essa data/turno).');
    }
  }

  async function handleTogglePublicado(c: Cardapio) {
    setErro(null);
    try {
      if (c.publicado) {
        await atualizarCardapio(c.id, { publicado: false });
      } else {
        const rtEscolhido = rtPorCardapio[c.id] || c.nutricionista_pessoa_id;
        if (!rtEscolhido) {
          setErro('Selecione o nutricionista responsável técnico antes de publicar o cardápio.');
          return;
        }
        await atualizarCardapio(c.id, { nutricionista_pessoa_id: rtEscolhido, publicado: true });
      }
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao publicar cardápio (verifique o responsável técnico).');
    }
  }

  async function handleAdicionarItem(cardapioId: string) {
    const form = novoItemPorCardapio[cardapioId];
    if (!form?.item_id || !form.quantidade) return;
    await adicionarItemCardapio({
      cardapio_id: cardapioId,
      item_id: form.item_id,
      descricao_preparacao: form.descricao || null,
      quantidade_planejada_por_aluno: Number(form.quantidade),
    });
    setNovoItemPorCardapio({ ...novoItemPorCardapio, [cardapioId]: { item_id: '', descricao: '', quantidade: '' } });
    await carregar();
  }

  async function handleRemoverItem(id: string) {
    await removerItemCardapio(id);
    await carregar();
  }

  async function handleRegistrarRefeicao(cardapioId: string) {
    const qtd = quantidadeAlunos[cardapioId];
    if (!qtd || !usuarioId) return;
    await registrarRefeicaoServida(cardapioId, Number(qtd), usuarioId);
    await carregar();
  }

  function nomeItem(itemId: string) {
    return itensEstoque.find((i) => i.id === itemId)?.nome ?? '—';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Novo cardápio (dia/turno)</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={novoTurno} onChange={(e) => setNovoTurno(e.target.value as Turno)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="Matutino">Matutino</option>
            <option value="Vespertino">Vespertino</option>
            <option value="Noturno">Noturno</option>
            <option value="Integral">Integral</option>
          </select>
          <button onClick={handleCriarCardapio} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
            <Plus className="w-4 h-4" /> Criar
          </button>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      <div className="space-y-4">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Próximos 7 dias</p>
        {cardapios.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum cardápio cadastrado para os próximos 7 dias.</p>
        ) : (
          cardapios.map((c) => (
            <div key={c.id} className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-black text-ms-main">
                  {new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} — {c.turno}
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={rtPorCardapio[c.id] ?? c.nutricionista_pessoa_id ?? ''}
                    onChange={(e) => setRtPorCardapio({ ...rtPorCardapio, [c.id]: e.target.value })}
                    disabled={c.publicado}
                    className="px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main disabled:opacity-50"
                  >
                    <option value="">RT (nutricionista)...</option>
                    {nutricionistas.map((n) => <option key={n.pessoa_id} value={n.pessoa_id}>{n.nome}</option>)}
                  </select>
                  <button
                    onClick={() => handleTogglePublicado(c)}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border font-bold ${c.publicado ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                  >
                    {c.publicado ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {c.publicado ? 'Publicado' : 'Rascunho'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {(itensPorCardapio[c.id] ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm px-3 py-1.5 bg-ms-dark rounded-lg border border-gray-800">
                    <span className="text-gray-300">{nomeItem(item.item_id)}{item.descricao_preparacao ? ` — ${item.descricao_preparacao}` : ''} ({item.quantidade_planejada_por_aluno}/aluno)</span>
                    <button onClick={() => handleRemoverItem(item.id)} className="p-1 hover:bg-red-500/20 text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={novoItemPorCardapio[c.id]?.item_id ?? ''}
                  onChange={(e) => setNovoItemPorCardapio({ ...novoItemPorCardapio, [c.id]: { ...(novoItemPorCardapio[c.id] ?? { descricao: '', quantidade: '' }), item_id: e.target.value } })}
                  className="px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main"
                >
                  <option value="">Item...</option>
                  {itensEstoque.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
                <input
                  placeholder="Descrição do prato"
                  value={novoItemPorCardapio[c.id]?.descricao ?? ''}
                  onChange={(e) => setNovoItemPorCardapio({ ...novoItemPorCardapio, [c.id]: { ...(novoItemPorCardapio[c.id] ?? { item_id: '', quantidade: '' }), descricao: e.target.value } })}
                  className="px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main w-40"
                />
                <input
                  type="number"
                  step="0.001"
                  placeholder="Qtd/aluno"
                  value={novoItemPorCardapio[c.id]?.quantidade ?? ''}
                  onChange={(e) => setNovoItemPorCardapio({ ...novoItemPorCardapio, [c.id]: { ...(novoItemPorCardapio[c.id] ?? { item_id: '', descricao: '' }), quantidade: e.target.value } })}
                  className="px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main w-24"
                />
                <button onClick={() => handleAdicionarItem(c.id)} className="px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                  Adicionar item
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                <span className="text-xs text-gray-500">Refeições servidas:</span>
                <input
                  type="number"
                  placeholder={refeicoesPorCardapio[c.id]?.toString() ?? 'quantidade'}
                  value={quantidadeAlunos[c.id] ?? ''}
                  onChange={(e) => setQuantidadeAlunos({ ...quantidadeAlunos, [c.id]: e.target.value })}
                  className="px-2 py-1 bg-ms-dark border border-gray-800 rounded-lg text-xs text-ms-main w-24"
                />
                <button onClick={() => handleRegistrarRefeicao(c.id)} className="px-3 py-1 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                  Registrar
                </button>
                {refeicoesPorCardapio[c.id] !== undefined && (
                  <span className="text-xs text-gray-500">(atual: {refeicoesPorCardapio[c.id]})</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
