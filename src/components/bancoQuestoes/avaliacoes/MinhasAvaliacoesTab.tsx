import { useCallback, useEffect, useState } from 'react';
import { BookUp, Camera, Check, ClipboardCheck, Copy, Eye, Loader2, Pencil, Printer, QrCode, Send, Square, Trash2, Users, Layers } from 'lucide-react';
import type { Avaliacao, AvaliacaoArea, ProvaAreaCota, StatusAvaliacao } from '../../../types/avaliacoes';
import {
  atualizarStatusAvaliacao,
  excluirAvaliacao,
  linkPublicoSimulado,
  listarAvaliacoesArea,
  listarMinhasAvaliacoes,
  obterProvasComCorrecaoPendente,
} from '../../../services/avaliacoesService';
import { AvaliacaoResultadosModal } from './AvaliacaoResultadosModal';
import { CorrigirDissertativasModal } from './CorrigirDissertativasModal';
import { EditarAvaliacaoModal } from './EditarAvaliacaoModal';
import { PreviewAvaliacaoAlunoModal } from './PreviewAvaliacaoAlunoModal';
import { ReimprimirAvaliacaoModal } from './ReimprimirAvaliacaoModal';
import { ImprimirFolhasModal } from './ImprimirFolhasModal';
import { ModoCorrecaoPage } from '../../correcao/ModoCorrecaoPage';
import { lancarNotasNoBoletim } from '../../../services/correcaoOmrService';
import { InserirQuestoesAreaModal } from '../../coordenacaoArea/InserirQuestoesAreaModal';
import { useAuth } from '../../../hooks/useAuth';

const STATUS_LABEL: Record<StatusAvaliacao, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADA: 'Publicada',
  ENCERRADA: 'Encerrada',
};

const STATUS_CLASS: Record<StatusAvaliacao, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  PUBLICADA: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  ENCERRADA: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
};

const MODO_LABEL = { IMPRESSA: 'Impressa', ONLINE: 'Online', AMBAS: 'Impressa e online' };

export function MinhasAvaliacoesTab() {
  const { usuarioId } = useAuth();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [avaliacoesArea, setAvaliacoesArea] = useState<AvaliacaoArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resultadosDe, setResultadosDe] = useState<Avaliacao | null>(null);
  const [reimprimirDe, setReimprimirDe] = useState<Avaliacao | null>(null);
  const [previewDe, setPreviewDe] = useState<Avaliacao | null>(null);
  const [corrigindoDe, setCorrigindoDe] = useState<Avaliacao | null>(null);
  const [inserindoCota, setInserindoCota] = useState<{ avaliacao: AvaliacaoArea; cota: ProvaAreaCota } | null>(null);
  // Ids das provas com resposta escrita ainda sem nota — decide se o botão "Corrigir" aparece.
  const [comCorrecaoPendente, setComCorrecaoPendente] = useState<Set<string>>(new Set());
  const [editandoDe, setEditandoDe] = useState<Avaliacao | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);
  const [folhasDe, setFolhasDe] = useState<Avaliacao | null>(null);
  const [corrigindoCameraDe, setCorrigindoCameraDe] = useState<Avaliacao | null>(null);
  const [notasLancadas, setNotasLancadas] = useState<string | null>(null);

  async function copiarLinkSimulado(a: Avaliacao) {
    await navigator.clipboard.writeText(linkPublicoSimulado(a.token_publico));
    setLinkCopiadoId(a.id);
    setTimeout(() => setLinkCopiadoId(null), 2000);
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [lista, pendentes, listaArea] = await Promise.all([
        listarMinhasAvaliacoes(),
        obterProvasComCorrecaoPendente(),
        listarAvaliacoesArea().catch(() => []),
      ]);
      setAvaliacoes(lista);
      setComCorrecaoPendente(pendentes);
      setAvaliacoesArea(listaArea.filter((av) => av.status !== 'PUBLICADA' || av.cotas?.some((c) => c.qtd_questoes > 0)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as avaliações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarStatus(id: string, novoStatus: StatusAvaliacao) {
    setProcessando(id);
    try {
      await atualizarStatusAvaliacao(id, novoStatus);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar o status da avaliação.');
    } finally {
      setProcessando(null);
    }
  }

  // Lançamento explícito, não automático: o professor confere o relatório e só então
  // manda para o boletim. Nota que aparece sozinha antes da conferência é pior que nota
  // atrasada — ver rpc_lancar_notas_boletim em create_correcao_omr.sql.
  async function lancarNotas(a: Avaliacao) {
    setProcessando(a.id);
    setErro(null);
    try {
      const quantas = await lancarNotasNoBoletim(a.id);
      setNotasLancadas(a.id);
      setTimeout(() => setNotasLancadas(null), 2500);
      if (quantas === 0) {
        setErro('Nenhuma nota foi lançada: ainda não há cartão corrigido nesta avaliação.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível lançar as notas.');
    } finally {
      setProcessando(null);
    }
  }

  async function excluir(a: Avaliacao) {
    if (!confirm(`Tem certeza de que deseja excluir a avaliação "${a.titulo}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setProcessando(a.id);
    try {
      await excluirAvaliacao(a.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir a avaliação.');
    } finally {
      setProcessando(null);
    }
  }

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;

  const btnSecondary =
    'flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors';

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm text-red-600 dark:text-red-400 font-bold">{erro}</p>}

      {avaliacoes.length === 0 ? (
        <p className="text-center text-ms-muted py-12">Nenhuma avaliação criada ainda. Use a aba "Nova Avaliação" para montar a primeira.</p>
      ) : (
        <div className="space-y-3">
          {avaliacoes.map((a) => (
            <div key={a.id} className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 space-y-2 shadow-sm">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-ms-main">{a.titulo}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${STATUS_CLASS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    {a.tipo === 'SIMULADO' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">Simulado · sem nota</span>
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
                    className={btnSecondary}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  {a.status === 'RASCUNHO' && (
                    <button
                      disabled={processando === a.id}
                      onClick={() => mudarStatus(a.id, 'PUBLICADA')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold disabled:opacity-40 shadow-sm transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Publicar
                    </button>
                  )}
                  {a.status === 'PUBLICADA' && (
                    <button
                      disabled={processando === a.id}
                      onClick={() => mudarStatus(a.id, 'ENCERRADA')}
                      className={btnSecondary}
                    >
                      <Square className="w-3.5 h-3.5" /> Encerrar
                    </button>
                  )}
                  {a.tipo === 'SIMULADO' && a.status !== 'RASCUNHO' && (
                    <button
                      onClick={() => copiarLinkSimulado(a)}
                      className={btnSecondary}
                    >
                      {linkCopiadoId === a.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {linkCopiadoId === a.id ? 'Copiado!' : 'Copiar link'}
                    </button>
                  )}
                  {(a.total_questoes ?? 0) > 0 && (
                    <button
                      onClick={() => setPreviewDe(a)}
                      className={btnSecondary}
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver como aluno
                    </button>
                  )}
                  {(a.modo === 'IMPRESSA' || a.modo === 'AMBAS' || a.tipo === 'SIMULADO') && (
                    <button
                      onClick={() => setReimprimirDe(a)}
                      className={btnSecondary}
                    >
                      <Printer className="w-3.5 h-3.5" /> Reimprimir
                    </button>
                  )}
                  {(a.modo === 'IMPRESSA' || a.modo === 'AMBAS') && (a.total_questoes ?? 0) > 0 && (
                    <button
                      onClick={() => setFolhasDe(a)}
                      className={btnSecondary}
                      title="Uma prova por aluno, com QR Code no cartão-resposta"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Folhas com QR
                    </button>
                  )}
                  {(a.modo === 'IMPRESSA' || a.modo === 'AMBAS') && a.status !== 'RASCUNHO' && (
                    <button
                      onClick={() => setCorrigindoCameraDe(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 shadow-sm transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" /> Corrigir pela câmera
                    </button>
                  )}
                  {a.modo_nota !== 'SEM_NOTA' && a.lancar_no_boletim && a.status !== 'RASCUNHO' && (
                    <button
                      disabled={processando === a.id}
                      onClick={() => void lancarNotas(a)}
                      className={btnSecondary}
                      title="Copia as notas corrigidas para Notas e Avaliações"
                    >
                      {notasLancadas === a.id
                        ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                        : <BookUp className="w-3.5 h-3.5" />}
                      {notasLancadas === a.id ? 'Lançadas!' : 'Lançar notas'}
                    </button>
                  )}
                  {comCorrecaoPendente.has(a.id) && (
                    <button
                      onClick={() => setCorrigindoDe(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-ms-gold/20 border border-amber-400 dark:border-ms-gold/50 text-amber-900 dark:text-ms-gold rounded-lg text-xs font-bold hover:bg-amber-200 dark:hover:bg-ms-gold/30 shadow-sm transition-colors"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> Corrigir dissertativas
                    </button>
                  )}
                  {a.status !== 'RASCUNHO' && (
                    <button
                      onClick={() => setResultadosDe(a)}
                      className={btnSecondary}
                    >
                      <Users className="w-3.5 h-3.5" /> Resultados
                    </button>
                  )}
                  <button
                    disabled={processando === a.id}
                    onClick={() => excluir(a)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/80 disabled:opacity-40 shadow-sm transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Seção: Avaliações da Minha Área em Elaboração (Colaborativas) */}
      {avaliacoesArea.length > 0 && (
        <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-800/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-ms-main">Avaliações da Sua Área em Elaboração</h3>
              <p className="text-xs text-ms-muted">
                O coordenador de área disponibilizou cotas de questões para você inserir na prova colaborativa.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {avaliacoesArea.map((av) => (
              <div key={av.id} className="bg-ms-dark/80 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="text-sm font-bold text-ms-main">{av.titulo}</h4>
                    <p className="text-xs text-ms-muted">
                      Área: {av.area_conhecimento} · {av.bimestre_id}º Bimestre · {av.turma_nomes?.join(', ') || 'Todas as turmas'}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-800/80 rounded-full">
                    {av.status_colaboracao === 'PUBLICADA' ? 'Publicada' : 'Em Elaboração'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {(av.cotas || []).map((cota) => {
                    const preenchida = cota.qtd_inserida >= cota.qtd_questoes;
                    return (
                      <div
                        key={`${cota.professor_id}-${cota.disciplina_id}`}
                        className="flex items-center justify-between p-2.5 bg-ms-card rounded-lg border border-gray-800 text-xs"
                      >
                        <div>
                          <p className="font-bold text-ms-main">{cota.disciplina_nome || 'Disciplina'}</p>
                          <p className="text-[11px] text-ms-muted">{cota.professor_nome}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              preenchida
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {cota.qtd_inserida}/{cota.qtd_questoes} q.
                          </span>
                          {av.status !== 'PUBLICADA' && (
                            <button
                              onClick={() => setInserindoCota({ avaliacao: av, cota })}
                              className="px-2.5 py-1 bg-ms-blue text-white hover:bg-blue-600 rounded font-bold text-[10px] shadow"
                            >
                              Inserir Questões
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resultadosDe && <AvaliacaoResultadosModal avaliacao={resultadosDe} onClose={() => setResultadosDe(null)} />}
      {reimprimirDe && <ReimprimirAvaliacaoModal avaliacao={reimprimirDe} onClose={() => setReimprimirDe(null)} />}
      {folhasDe && <ImprimirFolhasModal avaliacao={folhasDe} onClose={() => setFolhasDe(null)} />}
      {corrigindoCameraDe && (
        <ModoCorrecaoPage
          provaEsperadaId={corrigindoCameraDe.id}
          onFechar={() => { setCorrigindoCameraDe(null); void carregar(); }}
        />
      )}
      {previewDe && <PreviewAvaliacaoAlunoModal avaliacao={previewDe} onClose={() => setPreviewDe(null)} />}
      {inserindoCota && (
        <InserirQuestoesAreaModal
          avaliacao={inserindoCota.avaliacao}
          cota={inserindoCota.cota}
          onClose={() => setInserindoCota(null)}
          onSalvo={() => {
            setInserindoCota(null);
            carregar();
          }}
        />
      )}
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
