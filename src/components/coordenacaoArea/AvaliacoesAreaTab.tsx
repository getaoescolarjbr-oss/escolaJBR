import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Send, Eye, CheckCircle, Clock, Trash2, Users, FileText, Lock, Unlock, Pencil, QrCode } from 'lucide-react';
import type { AvaliacaoArea, ProvaAreaCota } from '../../types/avaliacoes';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { listarAvaliacoesArea, publicarAvaliacaoArea, excluirAvaliacao, definirBloqueioAvaliacaoArea } from '../../services/avaliacoesService';
import { NovaAvaliacaoAreaModal } from './NovaAvaliacaoAreaModal';
import { InserirQuestoesAreaModal } from './InserirQuestoesAreaModal';
import { ReimprimirAvaliacaoModal } from '../bancoQuestoes/avaliacoes/ReimprimirAvaliacaoModal';
import { ImprimirFolhasModal } from '../bancoQuestoes/avaliacoes/ImprimirFolhasModal';
import { AvaliacaoResultadosModal } from '../bancoQuestoes/avaliacoes/AvaliacaoResultadosModal';

interface Props {
  area: AreaConhecimento;
}

// prazo_edicao_area vem do banco em UTC (ex.: "2026-09-04T20:30:00+00:00"). Um
// input datetime-local mostra e edita em hora LOCAL do navegador — cortar a string UTC
// com .slice() reexibia a hora errada (mostrava 20:30 quando o coordenador tinha
// digitado 16:30 local). Monta o valor a partir dos componentes locais do Date.
function paraDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AvaliacoesAreaTab({ area }: Props) {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [editandoAvaliacao, setEditandoAvaliacao] = useState<AvaliacaoArea | null>(null);
  const [inserindoCota, setInserindoCota] = useState<{ avaliacao: AvaliacaoArea; cota: ProvaAreaCota } | null>(null);
  const [reimprimirDe, setReimprimirDe] = useState<AvaliacaoArea | null>(null);
  const [folhasQrDe, setFolhasQrDe] = useState<AvaliacaoArea | null>(null);
  const [resultadosDe, setResultadosDe] = useState<AvaliacaoArea | null>(null);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [bloqueandoId, setBloqueandoId] = useState<string | null>(null);
  // Valor do input datetime-local do prazo de edição, por avaliação — só existe enquanto
  // o coordenador está digitando; ao salvar, o estado de verdade volta a vir do backend.
  const [prazoInput, setPrazoInput] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const lista = await listarAvaliacoesArea(area);
      setAvaliacoes(lista);
    } catch (e: any) {
      setErro(e.message || 'Não foi possível carregar as avaliações de área.');
    } finally {
      setLoading(false);
    }
  }, [area]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handlePublicar(id: string) {
    if (!confirm('Publicar esta avaliação de área? Ao publicar, os campos de nota serão criados automaticamente no diário de cada professor da área correspondente.')) {
      return;
    }
    setPublicandoId(id);
    try {
      await publicarAvaliacaoArea(id);
      await carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao publicar avaliação.');
    } finally {
      setPublicandoId(null);
    }
  }

  async function handleExcluir(av: AvaliacaoArea) {
    const msg = av.status === 'PUBLICADA'
      ? `A avaliação "${av.titulo}" já está PUBLICADA. Excluí-la irá remover as notas sincronizadas nos diários dos professores. Deseja realmente excluir definitivamente?`
      : `Deseja realmente excluir a avaliação da área "${av.titulo}"? Esta ação não pode ser desfeita.`;

    if (!confirm(msg)) return;

    setExcluindoId(av.id);
    try {
      await excluirAvaliacao(av.id);
      await carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir avaliação de área.');
    } finally {
      setExcluindoId(null);
    }
  }

  async function alternarBloqueio(av: AvaliacaoArea) {
    setBloqueandoId(av.id);
    try {
      await definirBloqueioAvaliacaoArea(av.id, !av.edicao_bloqueada, av.prazo_edicao_area);
      await carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao travar/destravar a edição.');
    } finally {
      setBloqueandoId(null);
    }
  }

  async function salvarPrazo(av: AvaliacaoArea) {
    const valor = prazoInput[av.id];
    const prazoIso = valor ? new Date(valor).toISOString() : null;
    setBloqueandoId(av.id);
    try {
      await definirBloqueioAvaliacaoArea(av.id, av.edicao_bloqueada, prazoIso);
      await carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao definir o prazo de edição.');
    } finally {
      setBloqueandoId(null);
    }
  }

  async function limparPrazo(av: AvaliacaoArea) {
    setBloqueandoId(av.id);
    try {
      await definirBloqueioAvaliacaoArea(av.id, av.edicao_bloqueada, null);
      await carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao limpar o prazo de edição.');
    } finally {
      setBloqueandoId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-ms-main">Avaliações Colaborativas da Área</h2>
          <p className="text-xs text-ms-muted">
            Elabore avaliações interdisciplinares com cotas de questões distribuídas para os professores da área.
          </p>
        </div>
        <button
          onClick={() => setShowNovaModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow transition-all"
        >
          <Plus className="w-4 h-4" /> Nova Avaliação da Área
        </button>
      </div>

      {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
        </div>
      ) : avaliacoes.length === 0 ? (
        <div className="text-center py-12 bg-ms-card border border-gray-800 rounded-2xl p-6">
          <FileText className="w-12 h-12 text-ms-muted mx-auto mb-2 opacity-50" />
          <p className="text-ms-main font-bold text-sm">Nenhuma avaliação de área criada ainda.</p>
          <p className="text-xs text-ms-muted mt-1">
            Clique no botão acima para criar a primeira avaliação colaborativa de {area}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {avaliacoes.map((av) => {
            const cotas = av.cotas || [];
            const totalPrevisto = cotas.reduce((s, c) => s + c.qtd_questoes, 0);
            const totalInserido = cotas.reduce((s, c) => s + c.qtd_inserida, 0);
            const todasPreenchidas = totalPrevisto > 0 && totalInserido >= totalPrevisto;

            return (
              <div key={av.id} className="bg-ms-card border border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-ms-main">{av.titulo}</h3>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                        {av.bimestre_id}º Bimestre
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          av.status === 'PUBLICADA'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {av.status === 'PUBLICADA' ? 'Publicada' : 'Em Elaboração'}
                      </span>
                      {!av.edicao_permitida && (
                        <span
                          className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                          title={av.prazo_edicao_area ? `Prazo de edição venceu em ${new Date(av.prazo_edicao_area).toLocaleString('pt-BR')}` : undefined}
                        >
                          <Lock className="w-3 h-3" /> Edição bloqueada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ms-muted mt-1">
                      {av.tipo === 'AVALIACAO' ? 'Avaliação com nota' : 'Simulado'} · Valor {Number(av.valor_total).toFixed(2)} pts · Modo {av.modo}
                      {av.turma_nomes && av.turma_nomes.length > 0 ? ` · Turmas: ${av.turma_nomes.join(', ')}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {av.status !== 'PUBLICADA' && (
                      <button
                        onClick={() => handlePublicar(av.id)}
                        disabled={publicandoId === av.id || !todasPreenchidas}
                        title={!todasPreenchidas ? 'Aguardando preenchimento das cotas de questões' : undefined}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold disabled:opacity-40 shadow-sm transition-colors"
                      >
                        {publicandoId === av.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Publicar e Sincronizar Notas
                      </button>
                    )}
                    {av.status !== 'PUBLICADA' && (
                      <button
                        onClick={() => setEditandoAvaliacao(av)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                        title="Editar título, valor, datas, turmas e cotas da avaliação"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                    )}
                    <button
                      onClick={() => setReimprimirDe(av)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver Prova Impressa
                    </button>
                    <button
                      onClick={() => setFolhasQrDe(av)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                      title="Uma folha por aluno com QR Code, pra corrigir pela câmera"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Folhas com QR
                    </button>
                    {av.status === 'PUBLICADA' && (
                      <button
                        onClick={() => setResultadosDe(av)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" /> Resultados
                      </button>
                    )}
                    <button
                      onClick={() => alternarBloqueio(av)}
                      disabled={bloqueandoId === av.id}
                      title={av.edicao_bloqueada ? 'Destravar a edição de questões' : 'Travar a edição de questões (nenhum professor consegue mais alterar)'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-40 ${
                        av.edicao_bloqueada
                          ? 'bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-900/50 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
                          : 'bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {bloqueandoId === av.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : av.edicao_bloqueada ? (
                        <Unlock className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                      {av.edicao_bloqueada ? 'Destravar Edição' : 'Travar Edição'}
                    </button>
                    <button
                      onClick={() => handleExcluir(av)}
                      disabled={excluindoId === av.id || publicandoId === av.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-900/50 text-red-800 dark:text-red-300 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm transition-colors disabled:opacity-40"
                      title="Excluir esta avaliação da área"
                    >
                      {excluindoId === av.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Status das Cotas dos Professores */}
                <div className="bg-ms-dark/60 rounded-xl p-3 border border-gray-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-ms-muted">
                    <span>Acompanhamento das Cotas por Docente</span>
                    <span className={todasPreenchidas ? 'text-emerald-400' : 'text-amber-400'}>
                      {totalInserido} de {totalPrevisto} questões inseridas
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-ms-muted pb-1 border-b border-gray-800/80">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Bloquear edição automaticamente a partir de:</span>
                    <input
                      type="datetime-local"
                      value={prazoInput[av.id] ?? (av.prazo_edicao_area ? paraDatetimeLocal(av.prazo_edicao_area) : '')}
                      onChange={(e) => setPrazoInput((prev) => ({ ...prev, [av.id]: e.target.value }))}
                      className="px-2 py-1 bg-ms-card border border-gray-700 rounded text-ms-main text-[11px] outline-none focus:ring-2 focus:ring-ms-blueText"
                    />
                    <button
                      onClick={() => salvarPrazo(av)}
                      disabled={bloqueandoId === av.id}
                      className="px-2 py-1 bg-ms-card border border-gray-700 rounded font-bold hover:bg-gray-800 disabled:opacity-40"
                    >
                      Salvar prazo
                    </button>
                    {av.prazo_edicao_area && (
                      <button
                        onClick={() => { setPrazoInput((prev) => ({ ...prev, [av.id]: '' })); limparPrazo(av); }}
                        disabled={bloqueandoId === av.id}
                        className="px-2 py-1 text-red-400 hover:text-red-300 font-bold disabled:opacity-40"
                      >
                        Limpar prazo
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {cotas.map((c) => {
                      const preenchida = c.qtd_inserida >= c.qtd_questoes;
                      return (
                        <div
                          key={`${c.professor_id}-${c.disciplina_id}`}
                          className="flex items-center justify-between p-2.5 bg-ms-card rounded-lg border border-gray-800 text-xs"
                        >
                          <div>
                            <p className="font-bold text-ms-main">{c.professor_nome}</p>
                            <p className="text-[11px] text-ms-muted">{c.disciplina_nome}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                preenchida ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {c.qtd_inserida}/{c.qtd_questoes} q.
                            </span>
                            {av.status !== 'PUBLICADA' && av.edicao_permitida && (
                              <button
                                onClick={() => setInserindoCota({ avaliacao: av, cota: c })}
                                className="px-2 py-1 bg-ms-blue/20 text-ms-blueText rounded border border-ms-blueText/40 hover:bg-ms-blue/30 font-bold text-[10px]"
                                title="Inserir ou editar questões para esta disciplina"
                              >
                                {c.qtd_inserida > 0 ? 'Editar' : 'Inserir'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNovaModal && (
        <NovaAvaliacaoAreaModal
          area={area}
          onClose={() => setShowNovaModal(false)}
          onCriada={() => {
            setShowNovaModal(false);
            carregar();
          }}
        />
      )}

      {editandoAvaliacao && (
        <NovaAvaliacaoAreaModal
          area={area}
          avaliacaoExistente={editandoAvaliacao}
          onClose={() => setEditandoAvaliacao(null)}
          onCriada={() => {
            setEditandoAvaliacao(null);
            carregar();
          }}
        />
      )}

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

      {reimprimirDe && (
        <ReimprimirAvaliacaoModal
          avaliacao={reimprimirDe as any}
          onClose={() => setReimprimirDe(null)}
        />
      )}

      {folhasQrDe && (
        <ImprimirFolhasModal
          avaliacao={folhasQrDe as any}
          onClose={() => setFolhasQrDe(null)}
        />
      )}

      {resultadosDe && (
        <AvaliacaoResultadosModal
          avaliacao={resultadosDe as any}
          onClose={() => setResultadosDe(null)}
        />
      )}
    </div>
  );
}
