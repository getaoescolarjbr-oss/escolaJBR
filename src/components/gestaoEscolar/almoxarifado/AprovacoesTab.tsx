import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { RequisicaoItem } from '../../../types/almoxarifado';
import type { RequisicaoDetalhada } from '../../../services/almoxarifadoService';
import { listarRequisicoesPendentes, listarItensRequisicao, atenderRequisicao, recusarRequisicao } from '../../../services/almoxarifadoService';

type ItemComMaterial = RequisicaoItem & { material_nome: string; material_unidade: string };

export function AprovacoesTab() {
  const [pendentes, setPendentes] = useState<RequisicaoDetalhada[]>([]);
  const [itensPorRequisicao, setItensPorRequisicao] = useState<Record<string, ItemComMaterial[]>>({});
  const [decisoes, setDecisoes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const lista = await listarRequisicoesPendentes();
      setPendentes(lista);
      const entradas = await Promise.all(lista.map(async (r) => [r.id, await listarItensRequisicao(r.id)] as const));
      const itensMap: Record<string, ItemComMaterial[]> = Object.fromEntries(entradas);
      setItensPorRequisicao(itensMap);
      const decisoesIniciais: Record<string, number> = {};
      for (const itens of Object.values(itensMap)) {
        for (const item of itens) decisoesIniciais[item.id] = item.quantidade_solicitada;
      }
      setDecisoes(decisoesIniciais);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleAtender(requisicaoId: string) {
    setProcessandoId(requisicaoId);
    setErro(null);
    try {
      const itens = itensPorRequisicao[requisicaoId] ?? [];
      const decisoesRequisicao = itens.map((item) => ({ item_id: item.id, quantidade_atendida: decisoes[item.id] ?? 0 }));
      await atenderRequisicao(requisicaoId, decisoesRequisicao);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao atender requisição.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleRecusar(requisicaoId: string) {
    const motivo = window.prompt('Motivo da recusa:');
    if (!motivo) return;
    setProcessandoId(requisicaoId);
    setErro(null);
    try {
      await recusarRequisicao(requisicaoId, motivo);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao recusar requisição.');
    } finally {
      setProcessandoId(null);
    }
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-xs font-black uppercase tracking-wider text-ms-main">Requisições pendentes ({pendentes.length})</p>
      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {pendentes.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma requisição aguardando decisão.</p>
      ) : (
        pendentes.map((r) => (
          <div key={r.id} className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
            <div>
              <p className="text-sm font-bold text-ms-main">{r.setor}</p>
              <p className="text-[11px] text-gray-500">{r.solicitante_nome} · {new Date(r.criado_em).toLocaleDateString('pt-BR')}</p>
            </div>

            <div className="space-y-2">
              {(itensPorRequisicao[r.id] ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-300">{item.material_nome} <span className="text-[10px] text-gray-500">(solicitado: {item.quantidade_solicitada} {item.material_unidade})</span></span>
                  <input
                    type="number"
                    min={0}
                    max={item.quantidade_solicitada}
                    value={decisoes[item.id] ?? 0}
                    onChange={(e) => setDecisoes((d) => ({ ...d, [item.id]: Number(e.target.value) }))}
                    className="w-20 px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleAtender(r.id)}
                disabled={processandoId === r.id}
                className="flex items-center gap-1 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-500 hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                {processandoId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Atender
              </button>
              <button
                onClick={() => handleRecusar(r.id)}
                disabled={processandoId === r.id}
                className="flex items-center gap-1 px-4 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-gray-400 hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Recusar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
