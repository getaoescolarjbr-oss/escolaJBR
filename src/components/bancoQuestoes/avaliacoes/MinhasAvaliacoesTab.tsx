import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCheck, Copy, Eye, Loader2, Pencil, Printer, Send, Square, Trash2, Users } from 'lucide-react';
import type { Avaliacao, StatusAvaliacao } from '../../../types/avaliacoes';
import {
  atualizarStatusAvaliacao,
  excluirAvaliacao,
  linkPublicoSimulado,
  listarMinhasAvaliacoes,
  obterProvasComCorrecaoPendente,
} from '../../../services/avaliacoesService';
import { AvaliacaoResultadosModal } from './AvaliacaoResultadosModal';
import { CorrigirDissertativasModal } from './CorrigirDissertativasModal';
import { EditarAvaliacaoModal } from './EditarAvaliacaoModal';
import { PreviewAvaliacaoAlunoModal } from './PreviewAvaliacaoAlunoModal';
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
  const [previewDe, setPreviewDe] = useState<Avaliacao | null>(null);
  const [corrigindoDe, setCorrigindoDe] = useState<Avaliacao | null>(null);
  // Ids das provas com resposta escrita ainda sem nota — decide se o botão "Corrigir" aparece.
  const [comCorrecaoPendente, setComCorrecaoPendente] = useState<Set<string>>(new Set());
  const [editandoDe, setEditandoDe] = useState<Avaliacao | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);

  async function copiarLinkSimulado(a: Avaliacao) {
    await navigator.clipboard.writeText(linkPublicoSimulado(a.token_publico));
    setLinkCopiadoId(a.id);
    setTimeout(() => setLinkCopiadoId(null), 2000);
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [lista, pendentes] = await Promise.all([listarMinhasAvaliacoes(), obterProvasComCorrecaoPendente()]);
      setAvaliacoes(lista);
      setComCorrecaoPendente(pendentes);
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

  async function excluir(a: Avaliacao) {
    const aviso = a.status === 'RASCUNHO'
      ? 'Excluir esta avaliação? Essa ação não pode ser desfeita.'
      : a.tipo === 'SIMULADO'
      ? 'Excluir este simulado publicado? O link público deixa de funcionar e as respostas já enviadas pelos alunos serão apagadas. Essa ação não pode ser desfeita.'
      : 'Excluir esta avaliação publicada? A coluna de nota correspondente em "Notas e Avaliações", as notas já lançadas e as respostas dos alunos serão apagadas junto. Essa ação não pode ser desfeita.';
    if (!confirm(aviso)) return;
    const id = a.id;
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

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;

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
                    {a.tipo === 'SIMULADO' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-700/30 text-purple-300">Simulado · sem nota</span>
                    )}
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
                  <button
                    onClick={() => setEditandoDe(a)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
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
                  {a.tipo === 'SIMULADO' && a.status !== 'RASCUNHO' && (
                    <button
                      onClick={() => copiarLinkSimulado(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800"
                    >
                      {linkCopiadoId === a.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {linkCopiadoId === a.id ? 'Copiado!' : 'Copiar link'}
                    </button>
                  )}
                  {/* Conferir a avaliação com os olhos do aluno antes de os alunos
                      abrirem. Faz sentido em qualquer modo: mesmo numa prova só
                      impressa, é a forma mais rápida de revisar figura e fórmula
                      questão a questão. */}
                  {(a.total_questoes ?? 0) > 0 && (
                    <button
                      onClick={() => setPreviewDe(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver como aluno
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
                  {comCorrecaoPendente.has(a.id) && (
                    <button
                      onClick={() => setCorrigindoDe(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-gold/20 border border-ms-gold/50 text-ms-gold rounded-lg text-xs font-bold hover:bg-ms-gold/30"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> Corrigir dissertativas
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
                  <button
                    disabled={processando === a.id}
                    onClick={() => excluir(a)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 border border-red-800 text-red-300 rounded-lg text-xs font-bold hover:bg-red-900/50 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resultadosDe && <AvaliacaoResultadosModal avaliacao={resultadosDe} onClose={() => setResultadosDe(null)} />}
      {reimprimirDe && <ReimprimirAvaliacaoModal avaliacao={reimprimirDe} onClose={() => setReimprimirDe(null)} />}
      {previewDe && <PreviewAvaliacaoAlunoModal avaliacao={previewDe} onClose={() => setPreviewDe(null)} />}
      {corrigindoDe && (
        <CorrigirDissertativasModal
          avaliacao={corrigindoDe}
          onClose={() => setCorrigindoDe(null)}
          onCorrigido={() => {
            setCorrigindoDe(null);
            carregar();
          }}
        />
      )}
      {editandoDe && (
        <EditarAvaliacaoModal
          avaliacao={editandoDe}
          onClose={() => setEditandoDe(null)}
          onSalvo={() => {
            setEditandoDe(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
