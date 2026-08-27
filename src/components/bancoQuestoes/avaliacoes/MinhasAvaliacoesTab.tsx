import { useCallback, useEffect, useState } from 'react';
import { Loader2, Printer, Send, Square, Trash2, Users } from 'lucide-react';
import type { Avaliacao, StatusAvaliacao } from '../../../types/avaliacoes';
import { atualizarStatusAvaliacao, excluirAvaliacao, listarMinhasAvaliacoes } from '../../../services/avaliacoesService';
import { AvaliacaoResultadosModal } from './AvaliacaoResultadosModal';
import { ReimprimirAvaliacaoModal } from './ReimprimirAvaliacaoModal';

const STATUS_LABEL: Record<StatusAvaliacao, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADA: 'Publicada',
  ENCERRADA: 'Encerrada',
};

const STATUS_CLASS: Record<StatusAvaliacao, string> = {
  RASCUNHO: 'bg-gray-700/40 text-gray-300',
  PUBLICADA: 'bg-emerald-700/30 text-emerald-300',
  ENCERRADA: 'bg-amber-700/30 text-amber-300',
};

const MODO_LABEL = { IMPRESSA: 'Impressa', ONLINE: 'Online', AMBAS: 'Impressa e online' };

export function MinhasAvaliacoesTab() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resultadosDe, setResultadosDe] = useState<Avaliacao | null>(null);
  const [reimprimirDe, setReimprimirDe] = useState<Avaliacao | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setAvaliacoes(await listarMinhasAvaliacoes());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as avaliações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarStatus(id: string, status: StatusAvaliacao) {
    setProcessando(id);
    try {
      await atualizarStatusAvaliacao(id, status);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar a avaliação.');
    } finally {
      setProcessando(null);
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta avaliação? Essa ação não pode ser desfeita.')) return;
    setProcessando(id);
    try {
      await excluirAvaliacao(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir a avaliação.');
    } finally {
      setProcessando(null);
    }
  }

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" /></div>;

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}

      {avaliacoes.length === 0 ? (
        <p className="text-center text-ms-muted py-12">Nenhuma avaliação criada ainda. Use a aba "Nova Avaliação" para montar a primeira.</p>
      ) : (
        <div className="space-y-3">
          {avaliacoes.map((a) => (
            <div key={a.id} className="bg-ms-card border border-gray-800 rounded-xl px-5 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-ms-main">{a.titulo}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </div>
                  <p className="text-xs text-ms-muted mt-1">
                    {a.disciplina ? `${a.disciplina} · ` : ''}
                    {a.total_questoes ?? 0} questão(ões) · Valor {Number(a.valor_total).toFixed(2)} · {MODO_LABEL[a.modo]}
                    {a.turma_nomes && a.turma_nomes.length > 0 ? ` · ${a.turma_nomes.join(', ')}` : ''}
                  </p>
                  {a.prazo_entrega && (
                    <p className="text-xs text-ms-muted">Prazo: {new Date(a.prazo_entrega).toLocaleString('pt-BR')}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {a.status === 'RASCUNHO' && (
                    <button
                      disabled={processando === a.id}
                      onClick={() => mudarStatus(a.id, 'PUBLICADA')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" /> Publicar
                    </button>
                  )}
                  {a.status === 'PUBLICADA' && (
                    <button
                      disabled={processando === a.id}
                      onClick={() => mudarStatus(a.id, 'ENCERRADA')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800 disabled:opacity-40"
                    >
                      <Square className="w-3.5 h-3.5" /> Encerrar
                    </button>
                  )}
                  {(a.modo === 'IMPRESSA' || a.modo === 'AMBAS') && (
                    <button
                      onClick={() => setReimprimirDe(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800"
                    >
                      <Printer className="w-3.5 h-3.5" /> Reimprimir
                    </button>
                  )}
                  {(a.modo === 'ONLINE' || a.modo === 'AMBAS') && a.status !== 'RASCUNHO' && (
                    <button
                      onClick={() => setResultadosDe(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800"
                    >
                      <Users className="w-3.5 h-3.5" /> Resultados
                    </button>
                  )}
                  {a.status === 'RASCUNHO' && (
                    <button
                      disabled={processando === a.id}
                      onClick={() => excluir(a.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 border border-red-800 text-red-300 rounded-lg text-xs font-bold hover:bg-red-900/50 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resultadosDe && <AvaliacaoResultadosModal avaliacao={resultadosDe} onClose={() => setResultadosDe(null)} />}
      {reimprimirDe && <ReimprimirAvaliacaoModal avaliacao={reimprimirDe} onClose={() => setReimprimirDe(null)} />}
    </div>
  );
}
