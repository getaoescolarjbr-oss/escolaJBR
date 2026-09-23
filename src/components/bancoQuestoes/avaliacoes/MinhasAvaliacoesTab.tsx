import { useCallback, useEffect, useState } from 'react';
import { BookUp, Camera, Check, ClipboardCheck, Copy, Eye, Loader2, Pencil, Printer, QrCode, Send, Square, Trash2, Undo2, Users, Layers, FileText, User } from 'lucide-react';
import type { Avaliacao, AvaliacaoArea, ProvaAreaCota, StatusAvaliacao } from '../../../types/avaliacoes';
import {
  atualizarStatusAvaliacao,
  contarImpressaoELeituraAvaliacao,
  despublicarAvaliacao,
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
import { ConfirmacaoSubstituicaoError, lancarNotasNoBoletim } from '../../../services/correcaoOmrService';
import { InserirQuestoesAreaModal } from '../../coordenacaoArea/InserirQuestoesAreaModal';
import { useAuth } from '../../../hooks/useAuth';
import { faixaDoTipo, faixaIndividual } from '../../coordenacaoArea/faixaAvaliacao';

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
  const [previewAreaDe, setPreviewAreaDe] = useState<AvaliacaoArea | null>(null);
  // Ids das provas com resposta escrita ainda sem nota — decide se o botão "Corrigir" aparece.
  const [comCorrecaoPendente, setComCorrecaoPendente] = useState<Set<string>>(new Set());
  const [editandoDe, setEditandoDe] = useState<Avaliacao | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);
  const [folhasDe, setFolhasDe] = useState<Avaliacao | null>(null);
  const [corrigindoCameraDe, setCorrigindoCameraDe] = useState<Avaliacao | null>(null);
  const [notasLancadas, setNotasLancadas] = useState<string | null>(null);
  // Grupo aberto (geral / da área / individual) — lembrado no navegador.
  const [grupo, setGrupo] = useState<GrupoProfessor>(() => {
    try {
      const g = localStorage.getItem('prof-aval-grupo');
      return g === 'GERAL' || g === 'AREA' ? g : 'INDIVIDUAL';
    } catch { return 'INDIVIDUAL'; }
  });
  function escolherGrupo(g: GrupoProfessor) {
    setGrupo(g);
    try { localStorage.setItem('prof-aval-grupo', g); } catch { /* sem armazenamento: só não lembra */ }
  }

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
      let quantas: number;
      try {
        quantas = await lancarNotasNoBoletim(a.id);
      } catch (e) {
        if (e instanceof ConfirmacaoSubstituicaoError) {
          if (!confirm(
            `${e.conflitos} aluno(s) já têm nota preenchida diferente da que seria lançada agora ` +
            '(pode ter sido digitada manualmente). Substituir pela nota calculada na correção?'
          )) {
            return;
          }
          quantas = await lancarNotasNoBoletim(a.id, true);
        } else {
          throw e;
        }
      }
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

  async function despublicar(a: Avaliacao) {
    if (!confirm(
      `Despublicar "${a.titulo}"? A avaliação volta pra rascunho e some do boletim dos alunos — ` +
      'as questões continuam salvas, dá pra editar e publicar de novo depois.'
    )) return;
    setProcessando(a.id);
    setErro(null);
    try {
      await despublicarAvaliacao(a.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível despublicar a avaliação.');
    } finally {
      setProcessando(null);
    }
  }

  async function excluir(a: Avaliacao) {
    // Excluir apaga a prova em cascata (versões e alocações incluídas). Se já existem
    // folhas geradas — e ainda mais se alguma já foi lida pela câmera — os códigos que
    // estão no papel do aluno deixam de existir no banco e não têm mais conserto.
    let aviso = `Tem certeza de que deseja excluir a avaliação "${a.titulo}"? Esta ação não pode ser desfeita.`;
    try {
      const { alocacoes, leituras } = await contarImpressaoELeituraAvaliacao(a.id);
      if (alocacoes > 0) {
        aviso =
          `ATENÇÃO: esta avaliação já tem ${alocacoes} folha(s) gerada(s)` +
          (leituras > 0 ? ` e ${leituras} cartão(ões) já lido(s) pela câmera` : '') +
          `. Excluir invalida o código de TODAS as folhas já impressas — se algum aluno ` +
          `já respondeu no papel, o cartão dele deixa de poder ser lido, sem conserto. ` +
          `Tem certeza de que quer excluir "${a.titulo}"?`;
      }
    } catch {
      // Falhou a checagem (ex.: sem permissão de leitura): segue com o aviso genérico
      // em vez de travar a exclusão por causa de um aviso extra que não é essencial.
    }
    if (!confirm(aviso)) return;

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

  const proprias = avaliacoes.filter((a) => grupoDe(a) === grupo);
  // Cotas do professor nas avaliações de área/geral do grupo. A que ele mesmo criou já
  // aparece acima com todas as ações — aqui entra só a parte de inserir questões dela.
  const cotasDoGrupo = cotasDeOutros(grupo);

  // Avaliações de área/geral em que o professor tem cota, criadas por OUTRA pessoa (as que
  // ele criou já aparecem na lista própria, com a cota dentro do cartão).
  function cotasDeOutros(g: GrupoProfessor) {
    if (g === 'INDIVIDUAL') return [];
    return avaliacoesArea.filter(
      (av) =>
        (g === 'GERAL') === !!av.eh_prova_geral &&
        (av.cotas ?? []).some((c) => c.eh_minha_cota) &&
        !avaliacoes.some((a) => a.id === av.id)
    );
  }

  const btnSecondary =
    'flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors';

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm text-red-600 dark:text-red-400 font-bold">{erro}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { id: 'GERAL', titulo: 'Avaliações Gerais', sub: 'Várias áreas, um só gabarito', Icone: Layers, ativo: 'bg-violet-700 border-violet-700 text-white', inativo: 'bg-violet-50 border-violet-300 text-violet-900 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-200' },
          { id: 'AREA', titulo: 'Avaliações da Área', sub: 'Colaborativas, com cotas', Icone: FileText, ativo: 'bg-emerald-700 border-emerald-700 text-white', inativo: 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200' },
          { id: 'INDIVIDUAL', titulo: 'Avaliações Individuais', sub: 'Criadas por você', Icone: User, ativo: 'bg-amber-700 border-amber-700 text-white', inativo: 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200' },
        ] as const).map((g) => {
          const sel = grupo === g.id;
          const qtd = avaliacoes.filter((a) => grupoDe(a) === g.id).length + cotasDeOutros(g.id).length;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => escolherGrupo(g.id)}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all ${sel ? g.ativo + ' shadow-lg' : g.inativo + ' hover:shadow'}`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <g.Icone className="w-6 h-6 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-black">{g.titulo}</span>
                  <span className="block text-xs font-bold opacity-80 truncate">{g.sub}</span>
                </span>
              </span>
              <span className={`text-lg font-black px-3 py-0.5 rounded-full ${sel ? 'bg-white/20' : 'bg-white/70 dark:bg-black/20'}`}>{qtd}</span>
            </button>
          );
        })}
      </div>

      {proprias.length === 0 && cotasDoGrupo.length === 0 ? (
        <p className="text-center text-ms-muted py-12">
          {grupo === 'INDIVIDUAL'
            ? 'Nenhuma avaliação individual ainda. Use a aba "Nova Avaliação" para montar a primeira.'
            : grupo === 'GERAL'
            ? 'Nenhuma avaliação geral para você ainda.'
            : 'Nenhuma avaliação da área para você ainda.'}
        </p>
      ) : proprias.length === 0 ? null : (
        <div className="space-y-3">
          {proprias.map((a) => {
            const faixa = a.eh_prova_area ? faixaDoTipo(a) : faixaIndividual(a.disciplina, a.tipo === 'SIMULADO');
            return (
            <div key={a.id} className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4 space-y-2 shadow-sm">
              <div className={`-mx-5 -mt-4 mb-1 px-5 py-2 rounded-t-xl flex items-center gap-2 text-white text-xs font-black uppercase tracking-wider ${faixa.cor}`}>
                <faixa.Icone className="w-4 h-4 shrink-0" />
                <span className="truncate">{faixa.rotulo}</span>
              </div>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-ms-main">{a.titulo}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${STATUS_CLASS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-ms-muted">{(a.turma_nomes?.length ?? 0) > 1 ? 'Turmas' : 'Turma'}:</span>
                    {(a.turma_nomes ?? []).length === 0 && <span className="text-xs text-ms-muted">—</span>}
                    {[...(a.turma_nomes ?? [])].sort().map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-lg bg-blue-700 text-white text-sm font-black shadow-sm">{t}</span>
                    ))}
                  </div>
                  <p className="text-xs text-ms-muted mt-1.5">
                    {a.disciplina ? `${a.disciplina} · ` : ''}
                    {a.total_questoes ?? 0} questão(ões) · Valor {Number(a.valor_total).toFixed(2)} · {MODO_LABEL[a.modo]}
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
                  {/* Avaliação de área é publicada só pela aba Coordenação de Área — o botão
                      genérico daqui não sabe distribuir a nota por professor/turma (ver
                      rpc_publicar_avaliacao_area vs. atualizarStatusAvaliacao). */}
                  {a.status === 'RASCUNHO' && a.eh_prova_area && (
                    <span className={btnSecondary + ' cursor-default hover:bg-transparent dark:hover:bg-transparent'} title="Esta é uma avaliação colaborativa de área: publique pela aba Coordenação de Área > Avaliações da Área, que lança a nota certa para cada professor/turma.">
                      <Send className="w-3.5 h-3.5" /> Publique pela Coordenação de Área
                    </span>
                  )}
                  {a.status === 'RASCUNHO' && !a.eh_prova_area && (
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
                  {a.status === 'PUBLICADA' && (
                    <button
                      disabled={processando === a.id}
                      onClick={() => despublicar(a)}
                      className={btnSecondary}
                      title="Volta pra rascunho e remove a nota do boletim (só funciona se ninguém já respondeu/corrigiu)"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Despublicar
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
              <MinhasCotas
                avaliacao={avaliacoesArea.find((x) => x.id === a.id)}
                onInserir={(av, cota) => setInserindoCota({ avaliacao: av, cota })}
              />
            </div>
            );
          })}
        </div>
      )}

      {/* Cotas de questões do professor nas avaliações do grupo aberto (área ou geral) */}
      {cotasDoGrupo.length > 0 && (
        <div className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-ms-main">Suas cotas de questões</h3>
              <p className="text-xs text-ms-muted">
                O coordenador de área disponibilizou cotas de questões para você inserir na prova colaborativa.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {cotasDoGrupo.map((av) => {
              const faixa = faixaDoTipo(av);
              return (
              <div key={av.id} className="bg-ms-dark/80 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                <div className={`-mx-4 -mt-4 px-4 py-2 rounded-t-xl flex items-center gap-2 text-white text-xs font-black uppercase tracking-wider ${faixa.cor}`}>
                  <faixa.Icone className="w-4 h-4 shrink-0" />
                  <span className="truncate">{faixa.rotulo}</span>
                </div>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="text-sm font-bold text-ms-main">{av.titulo}</h4>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-ms-muted">{(av.turma_nomes?.length ?? 0) > 1 ? 'Turmas' : 'Turma'}:</span>
                    {(av.turma_nomes ?? []).length === 0 && <span className="text-xs text-ms-muted">—</span>}
                    {[...(av.turma_nomes ?? [])].sort().map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-lg bg-blue-700 text-white text-sm font-black shadow-sm">{t}</span>
                    ))}
                  </div>
                    <p className="text-xs text-ms-muted mt-1.5">{av.bimestre_id}º Bimestre</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(av.total_questoes ?? 0) > 0 && (
                      <button
                        onClick={() => setPreviewAreaDe(av)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-ms-card border border-gray-700 text-ms-main rounded-full text-[11px] font-bold hover:bg-gray-800"
                      >
                        <Eye className="w-3 h-3" /> Pré-visualizar
                      </button>
                    )}
                    {!av.edicao_permitida && (
                      <span
                        className="text-xs font-bold px-2.5 py-1 bg-red-950/80 text-red-300 border border-red-800/80 rounded-full"
                        title={av.prazo_edicao_area ? `Prazo de edição: ${new Date(av.prazo_edicao_area).toLocaleString('pt-BR')}` : undefined}
                      >
                        Edição bloqueada
                      </span>
                    )}
                    <span className="text-xs font-bold px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-800/80 rounded-full">
                      {av.status_colaboracao === 'PUBLICADA' ? 'Publicada' : 'Em Elaboração'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {/* Só a(s) própria(s) disciplina(s) do professor logado — rpc_listar_avaliacoes_area
                      já marca eh_minha_cota; evita ver (e antes até conseguir mexer em) cota alheia. */}
                  {(av.cotas || []).filter((c) => c.eh_minha_cota).map((cota) => {
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
                          {av.status !== 'PUBLICADA' && av.edicao_permitida && (
                            <button
                              onClick={() => setInserindoCota({ avaliacao: av, cota })}
                              className="px-2.5 py-1 bg-ms-blue text-white hover:bg-blue-600 rounded font-bold text-[10px] shadow"
                            >
                              {cota.qtd_inserida > 0 ? 'Editar Questões' : 'Inserir Questões'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
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
      {previewAreaDe && <PreviewAvaliacaoAlunoModal avaliacao={previewAreaDe} onClose={() => setPreviewAreaDe(null)} />}
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

type GrupoProfessor = 'GERAL' | 'AREA' | 'INDIVIDUAL';

function grupoDe(a: Avaliacao): GrupoProfessor {
  if (!a.eh_prova_area) return 'INDIVIDUAL';
  return a.eh_prova_geral ? 'GERAL' : 'AREA';
}

// A(s) cota(s) do professor dentro do cartão de uma avaliação de área/geral que ele mesmo
// criou — assim ela não aparece duplicada em "Suas cotas de questões".
function MinhasCotas({ avaliacao, onInserir }: { avaliacao?: AvaliacaoArea; onInserir: (av: AvaliacaoArea, cota: ProvaAreaCota) => void }) {
  const minhas = (avaliacao?.cotas ?? []).filter((c) => c.eh_minha_cota);
  if (!avaliacao || minhas.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-200 dark:border-gray-800">
      <span className="text-[11px] font-black uppercase tracking-wider text-ms-muted">Sua cota:</span>
      {minhas.map((cota) => {
        const preenchida = cota.qtd_inserida >= cota.qtd_questoes;
        return (
          <span key={`${cota.professor_id}-${cota.disciplina_id}`} className="flex items-center gap-2 text-xs">
            <span className="font-bold text-ms-main">{cota.disciplina_nome || 'Disciplina'}</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                preenchida
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {cota.qtd_inserida}/{cota.qtd_questoes} q.
            </span>
            {avaliacao.status !== 'PUBLICADA' && avaliacao.edicao_permitida && (
              <button
                onClick={() => onInserir(avaliacao, cota)}
                className="px-2.5 py-1 bg-ms-blue text-white hover:bg-blue-600 rounded font-bold text-[10px] shadow"
              >
                {cota.qtd_inserida > 0 ? 'Editar Questões' : 'Inserir Questões'}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
