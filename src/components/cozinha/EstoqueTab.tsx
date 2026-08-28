import { useEffect, useState } from 'react';
import { Loader2, Plus, PackagePlus, PackageMinus, Receipt } from 'lucide-react';
import { SectionIcon } from '../ui/SectionIcon';
import { useAuth } from '../../hooks/useAuth';
import type { EstoqueItem, Fornecedor, SaldoLote, UnidadeMedida, ClassificacaoPnae, TipoMovimentacao, OrigemLote, FonteRecurso, NotaFiscal } from '../../types/cozinha';
import {
  listarItensEstoque,
  criarItemEstoque,
  listarFornecedores,
  listarNotasFiscais,
  criarNotaFiscal,
  listarSaldos,
  receberLote,
  registrarMovimentacao,
} from '../../services/cozinhaService';

const ROTULOS_ORIGEM: Record<OrigemLote, string> = {
  AGRICULTURA_FAMILIAR: 'Agricultura familiar',
  LICITACAO: 'Licitação',
  DOACAO: 'Doação',
  OUTRO: 'Outro',
};

const ROTULOS_FONTE_RECURSO: Record<FonteRecurso, string> = {
  PNAE: 'PNAE',
  PDDE: 'PDDE',
  OUTRO: 'Outro recurso',
};

const ROTULOS_CLASSIFICACAO: Record<ClassificacaoPnae, string> = {
  IN_NATURA: 'In natura',
  MINIMAMENTE_PROCESSADO: 'Minimamente processado',
  PROCESSADO: 'Processado',
  ULTRAPROCESSADO: 'Ultraprocessado',
};

export function EstoqueTab() {
  const { usuarioId } = useAuth();
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>([]);
  const [saldos, setSaldos] = useState<SaldoLote[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [novoItem, setNovoItem] = useState({ nome: '', unidade_medida: 'KG' as UnidadeMedida, classificacao_pnae: 'IN_NATURA' as ClassificacaoPnae, perecivel: true, estoque_minimo: '' });
  const [novaNota, setNovaNota] = useState({ fornecedor_id: '', numero: '', data: new Date().toISOString().slice(0, 10), valor: '' });
  const [recebimento, setRecebimento] = useState({
    item_id: '', numero_lote: '', fornecedor_id: '', nota_fiscal_id: '', validade: '', valor_unitario: '', quantidade: '',
    origem: 'OUTRO' as OrigemLote, fonte_recurso: 'PNAE' as FonteRecurso,
  });
  const [movimentacao, setMovimentacao] = useState({ lote_id: '', tipo: 'SAIDA' as TipoMovimentacao, quantidade: '', motivo: '' });

  async function carregar() {
    setLoading(true);
    try {
      const [listaItens, listaFornecedores, listaNotasFiscais, listaSaldos] = await Promise.all([listarItensEstoque(), listarFornecedores(), listarNotasFiscais(), listarSaldos()]);
      setItens(listaItens);
      setFornecedores(listaFornecedores.filter((f) => f.ativo));
      setNotasFiscais(listaNotasFiscais);
      setSaldos(listaSaldos);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriarItem() {
    if (!novoItem.nome) {
      setErro('Informe o nome do item.');
      return;
    }
    setErro(null);
    try {
      await criarItemEstoque({
        nome: novoItem.nome,
        unidade_medida: novoItem.unidade_medida,
        classificacao_pnae: novoItem.classificacao_pnae,
        perecivel: novoItem.perecivel,
        estoque_minimo: novoItem.estoque_minimo ? Number(novoItem.estoque_minimo) : 0,
        ativo: true,
      });
      setNovoItem({ nome: '', unidade_medida: 'KG', classificacao_pnae: 'IN_NATURA', perecivel: true, estoque_minimo: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar item.');
    }
  }

  async function handleCriarNotaFiscal() {
    if (!novaNota.fornecedor_id || !novaNota.numero || !novaNota.valor || !usuarioId) {
      setErro('Preencha fornecedor, número e valor da nota fiscal.');
      return;
    }
    setErro(null);
    try {
      await criarNotaFiscal({
        fornecedor_id: novaNota.fornecedor_id,
        numero: novaNota.numero,
        data: novaNota.data,
        valor: Number(novaNota.valor),
        arquivo_path: null,
        registrado_por: usuarioId,
      });
      setNovaNota({ fornecedor_id: '', numero: '', data: new Date().toISOString().slice(0, 10), valor: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar nota fiscal.');
    }
  }

  async function handleReceberLote() {
    if (!recebimento.item_id || !recebimento.numero_lote || !recebimento.quantidade || !usuarioId) {
      setErro('Preencha item, número do lote e quantidade recebida.');
      return;
    }
    setErro(null);
    try {
      await receberLote(
        {
          item_id: recebimento.item_id,
          numero_lote: recebimento.numero_lote,
          fornecedor_id: recebimento.fornecedor_id || null,
          nota_fiscal_id: recebimento.nota_fiscal_id || null,
          validade: recebimento.validade || null,
          valor_unitario: recebimento.valor_unitario ? Number(recebimento.valor_unitario) : null,
          origem: recebimento.origem,
          fonte_recurso: recebimento.fonte_recurso,
          recebido_por: usuarioId,
        },
        Number(recebimento.quantidade)
      );
      setRecebimento({ item_id: '', numero_lote: '', fornecedor_id: '', nota_fiscal_id: '', validade: '', valor_unitario: '', quantidade: '', origem: 'OUTRO', fonte_recurso: 'PNAE' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar recebimento.');
    }
  }

  async function handleRegistrarMovimentacao() {
    if (!movimentacao.lote_id || !movimentacao.quantidade || !usuarioId) {
      setErro('Selecione o lote e informe a quantidade.');
      return;
    }
    setErro(null);
    try {
      await registrarMovimentacao(movimentacao.lote_id, movimentacao.tipo, Number(movimentacao.quantidade), movimentacao.motivo || undefined);
      setMovimentacao({ lote_id: '', tipo: 'SAIDA', quantidade: '', motivo: '' });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar movimentação.');
    }
  }

  function nomeItem(itemId: string) {
    return itens.find((i) => i.id === itemId)?.nome ?? '—';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Catálogo de itens</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Nome do item" value={novoItem.nome} onChange={(e) => setNovoItem({ ...novoItem, nome: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={novoItem.unidade_medida} onChange={(e) => setNovoItem({ ...novoItem, unidade_medida: e.target.value as UnidadeMedida })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {(['KG', 'LITRO', 'UNIDADE', 'PACOTE', 'CAIXA', 'DUZIA'] as UnidadeMedida[]).map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <select value={novoItem.classificacao_pnae} onChange={(e) => setNovoItem({ ...novoItem, classificacao_pnae: e.target.value as ClassificacaoPnae })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_CLASSIFICACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <input type="number" step="0.001" placeholder="Estoque mínimo" value={novoItem.estoque_minimo} onChange={(e) => setNovoItem({ ...novoItem, estoque_minimo: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ms-main">
          <input type="checkbox" checked={novoItem.perecivel} onChange={(e) => setNovoItem({ ...novoItem, perecivel: e.target.checked })} />
          Perecível
        </label>
        <button onClick={handleCriarItem} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Adicionar item
        </button>
        <div className="flex flex-wrap gap-2 pt-2">
          {itens.map((i) => (
            <span key={i.id} className="text-xs px-2 py-1 rounded-full bg-ms-dark border border-gray-800 text-gray-300">
              {i.nome} ({i.unidade_medida})
            </span>
          ))}
        </div>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={Receipt} cor="amber" /> Nota fiscal (guarda de 5 anos)</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={novaNota.fornecedor_id} onChange={(e) => setNovaNota({ ...novaNota, fornecedor_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Fornecedor...</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input placeholder="Número da NF" value={novaNota.numero} onChange={(e) => setNovaNota({ ...novaNota, numero: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="date" value={novaNota.data} onChange={(e) => setNovaNota({ ...novaNota, data: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="number" step="0.01" placeholder="Valor (R$)" value={novaNota.valor} onChange={(e) => setNovaNota({ ...novaNota, valor: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <button onClick={handleCriarNotaFiscal} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Registrar nota fiscal
        </button>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={PackagePlus} cor="emerald" /> Receber lote</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={recebimento.item_id} onChange={(e) => setRecebimento({ ...recebimento, item_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Item...</option>
            {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
          <input placeholder="Nº do lote" value={recebimento.numero_lote} onChange={(e) => setRecebimento({ ...recebimento, numero_lote: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={recebimento.fornecedor_id} onChange={(e) => setRecebimento({ ...recebimento, fornecedor_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Fornecedor (opcional)...</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input type="date" placeholder="Validade" value={recebimento.validade} onChange={(e) => setRecebimento({ ...recebimento, validade: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="number" step="0.01" placeholder="Valor unitário (R$)" value={recebimento.valor_unitario} onChange={(e) => setRecebimento({ ...recebimento, valor_unitario: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input type="number" step="0.001" placeholder="Quantidade recebida" value={recebimento.quantidade} onChange={(e) => setRecebimento({ ...recebimento, quantidade: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <select value={recebimento.origem} onChange={(e) => setRecebimento({ ...recebimento, origem: e.target.value as OrigemLote })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_ORIGEM).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <select value={recebimento.fonte_recurso} onChange={(e) => setRecebimento({ ...recebimento, fonte_recurso: e.target.value as FonteRecurso })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_FONTE_RECURSO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <select value={recebimento.nota_fiscal_id} onChange={(e) => setRecebimento({ ...recebimento, nota_fiscal_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Nota fiscal (opcional)...</option>
            {notasFiscais.map((n) => <option key={n.id} value={n.id}>NF {n.numero} — R$ {n.valor.toFixed(2)}</option>)}
          </select>
        </div>
        <button onClick={handleReceberLote} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <PackagePlus className="w-4 h-4" /> Registrar recebimento
        </button>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={PackageMinus} cor="red" /> Registrar saída/perda/ajuste</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={movimentacao.lote_id} onChange={(e) => setMovimentacao({ ...movimentacao, lote_id: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="">Lote...</option>
            {saldos.map((s) => (
              <option key={s.lote_id} value={s.lote_id}>{nomeItem(s.item_id)} — lote {s.numero_lote} (saldo: {s.saldo_atual})</option>
            ))}
          </select>
          <select value={movimentacao.tipo} onChange={(e) => setMovimentacao({ ...movimentacao, tipo: e.target.value as TipoMovimentacao })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            <option value="SAIDA">Saída (uso no cardápio)</option>
            <option value="PERDA">Perda (vencido/danificado)</option>
            <option value="AJUSTE">Ajuste de inventário</option>
          </select>
          <input type="number" step="0.001" placeholder="Quantidade" value={movimentacao.quantidade} onChange={(e) => setMovimentacao({ ...movimentacao, quantidade: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <input placeholder="Motivo (opcional)" value={movimentacao.motivo} onChange={(e) => setMovimentacao({ ...movimentacao, motivo: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        <button onClick={handleRegistrarMovimentacao} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <PackageMinus className="w-4 h-4" /> Registrar
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Saldo atual por lote</p>
        {saldos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum lote registrado.</p>
        ) : (
          saldos.map((s) => {
            const vencido = s.validade && new Date(s.validade + 'T12:00:00') < new Date();
            return (
              <div key={s.lote_id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${vencido ? 'bg-red-950/10 border-red-700/40' : 'bg-ms-card border-gray-800'}`}>
                <span className="text-sm text-ms-main">{nomeItem(s.item_id)} — lote {s.numero_lote}{s.validade ? ` (validade ${new Date(s.validade + 'T12:00:00').toLocaleDateString('pt-BR')})` : ''}</span>
                <span className={`text-sm font-black ${vencido ? 'text-red-500' : 'text-ms-blueText'}`}>{s.saldo_atual}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
