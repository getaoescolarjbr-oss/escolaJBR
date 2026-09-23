import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Send, Eye, CheckCircle, Clock, Trash2, Users, FileText, Lock, Unlock, Pencil, QrCode, Settings, Undo2, Layers, Link2, SlidersHorizontal, UserCheck, ClipboardList, FileSpreadsheet } from 'lucide-react';
import type { AvaliacaoArea, ProvaAreaCota } from '../../types/avaliacoes';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { listarAvaliacoesArea, publicarAvaliacaoArea, excluirAvaliacao, contarImpressaoELeituraAvaliacao, definirBloqueioAvaliacaoArea, despublicarAvaliacao, linkPublicoSimulado } from '../../services/avaliacoesService';
import { NovaAvaliacaoAreaModal } from './NovaAvaliacaoAreaModal';
import { NovaAvaliacaoGeralModal } from './NovaAvaliacaoGeralModal';
import { ConfigurarAreaGeralModal } from './ConfigurarAreaGeralModal';
import { CorretoresModal } from './CorretoresModal';
import { NotasTurmaModal } from './NotasTurmaModal';
import { faixaDoTipo } from './faixaAvaliacao';
import { InserirQuestoesAreaModal } from './InserirQuestoesAreaModal';
import { ReimprimirAvaliacaoModal } from '../bancoQuestoes/avaliacoes/ReimprimirAvaliacaoModal';
import { ImprimirFolhasModal } from '../bancoQuestoes/avaliacoes/ImprimirFolhasModal';
import { ConfigImpressaoAreaModal } from './ConfigImpressaoAreaModal';
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
  const [showNovaGeral, setShowNovaGeral] = useState(false);
  const [configurandoGeral, setConfigurandoGeral] = useState<AvaliacaoArea | null>(null);
  const [editandoGeral, setEditandoGeral] = useState<AvaliacaoArea | null>(null);
  const [showNovaSoNota, setShowNovaSoNota] = useState(false);
  const [corretoresDe, setCorretoresDe] = useState<AvaliacaoArea | null>(null);
  const [notasDe, setNotasDe] = useState<AvaliacaoArea | null>(null);
  const [grupo, setGrupo] = useState<GrupoAvaliacao>(() => {
    try { return localStorage.getItem('coord-aval-grupo') === 'AREA' ? 'AREA' : 'GERAL'; } catch { return 'GERAL'; }
  });
  function escolherGrupo(g: GrupoAvaliacao) {
    setGrupo(g);
    try { localStorage.setItem('coord-aval-grupo', g); } catch { /* sem armazenamento: só não lembra */ }
  }
  const gerais = avaliacoes.filter((a) => a.eh_prova_geral);
  const daArea = avaliacoes.filter((a) => !a.eh_prova_geral);
  const lista = grupo === 'GERAL' ? gerais : daArea;
  const [editandoAvaliacao, setEditandoAvaliacao] = useState<AvaliacaoArea | null>(null);
  const [inserindoCota, setInserindoCota] = useState<{ avaliacao: AvaliacaoArea; cota: ProvaAreaCota } | null>(null);
  const [reimprimirDe, setReimprimirDe] = useState<AvaliacaoArea | null>(null);
  const [folhasQrDe, setFolhasQrDe] = useState<AvaliacaoArea | null>(null);
  const [configImpressaoDe, setConfigImpressaoDe] = useState<AvaliacaoArea | null>(null);
  const [resultadosDe, setResultadosDe] = useState<AvaliacaoArea | null>(null);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [despublicandoId, setDespublicandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [bloqueandoId, setBloqueandoId] = useState<string | null>(null);
  // Valor do input datetime-local do prazo de edição, por avaliação — só existe enquanto
  // o coordenador está digitando; ao salvar, o estado de verdade volta a vir do backend.
  const [prazoInput, setPrazoInput] = useState<Record<string, string>>({});

  // O spinner de tela cheia só faz sentido na primeira carga: nos recarregamentos depois de
  // salvar/publicar/despublicar (chamados com a lista já na tela), ele trocava o conteúdo
  // inteiro por um spinner, a página encolhia, e ao voltar o scroll já tinha ido pro topo —
  // é essa troca de altura que dava a sensação de "pular pro início" a cada ação.
  const carregouUmaVez = useRef(false);
  const carregar = useCallback(async () => {
    const primeiraCarga = !carregouUmaVez.current;
    if (primeiraCarga) setLoading(true);
    setErro(null);
    const scrollY = window.scrollY;
    try {
      const lista = await listarAvaliacoesArea(area);
      setAvaliacoes(lista);
      carregouUmaVez.current = true;
    } catch (e: any) {
      setErro(e.message || 'Não foi possível carregar as avaliações de área.');
    } finally {
      if (primeiraCarga) setLoading(false);
      if (!primeiraCarga) requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
    }
  }, [area]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handlePublicar(av: AvaliacaoArea) {
    const id = av.id;
    const msg = av.eh_prova_geral
      ? 'Publicar esta avaliação geral? Os campos de nota serão criados no diário dos professores escolhidos por cada área, só nas turmas em que eles dão aula.'
      : 'Publicar esta avaliação de área? Ao publicar, os campos de nota serão criados automaticamente no diário de cada professor da área correspondente.';
    if (!confirm(msg)) {
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

  async function handleDespublicar(av: AvaliacaoArea) {
    if (!confirm(
      `Despublicar "${av.titulo}"? A avaliação volta pra rascunho e a nota some do boletim de cada professor — ` +
      'as questões e cotas continuam salvas, dá pra editar e publicar de novo depois.'
    )) return;
    setDespublicandoId(av.id);
    try {
      await despublicarAvaliacao(av.id);
      await carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao despublicar avaliação.');
    } finally {
      setDespublicandoId(null);
    }
  }

  async function handleExcluir(av: AvaliacaoArea) {
    let msg = av.status === 'PUBLICADA'
      ? `A avaliação "${av.titulo}" já está PUBLICADA. Excluí-la irá remover as notas sincronizadas nos diários dos professores. Deseja realmente excluir definitivamente?`
      : `Deseja realmente excluir a avaliação da área "${av.titulo}"? Esta ação não pode ser desfeita.`;

    // Excluir apaga a prova em cascata (versões e alocações incluídas) — se já existem
    // folhas geradas, os códigos que estão no papel de algum professor/turma deixam de
    // existir no banco, sem conserto depois.
    try {
      const { alocacoes, leituras } = await contarImpressaoELeituraAvaliacao(av.id);
      if (alocacoes > 0) {
        msg =
          `ATENÇÃO: esta avaliação já tem ${alocacoes} folha(s) gerada(s)` +
          (leituras > 0 ? ` e ${leituras} cartão(ões) já lido(s) pela câmera` : '') +
          `. Excluir invalida o código de TODAS as folhas já impressas — se algum aluno ` +
          `já respondeu no papel, o cartão dele deixa de poder ser lido, sem conserto. ` +
          msg;
      }
    } catch {
      // Segue com o aviso genérico se a checagem falhar.
    }

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
      {/* Grupos: cada tipo de avaliação tem sua cor e sua lista (mais recentes primeiro). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          { id: 'GERAL', titulo: 'Avaliações Gerais', sub: 'Várias áreas, um só gabarito', qtd: gerais.length, Icone: Layers, ativo: 'bg-violet-700 border-violet-700 text-white', inativo: 'bg-violet-50 border-violet-300 text-violet-900 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-200' },
          { id: 'AREA', titulo: `Avaliações da Área`, sub: area, qtd: daArea.length, Icone: FileText, ativo: 'bg-emerald-700 border-emerald-700 text-white', inativo: 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200' },
        ] as const).map((g) => {
          const sel = grupo === g.id;
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
              <span className={`text-lg font-black px-3 py-0.5 rounded-full ${sel ? 'bg-white/20' : 'bg-white/70 dark:bg-black/20'}`}>{g.qtd}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-ms-muted">
          {grupo === 'GERAL'
            ? 'Avaliações montadas por várias áreas (com questões ou só de nota). Mais recentes primeiro.'
            : `Avaliações colaborativas de ${area}, com cotas de questões por professor. Mais recentes primeiro.`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {grupo === 'GERAL' ? (
            <>
              <button
                onClick={() => setShowNovaGeral(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-700 text-white rounded-xl text-xs font-bold hover:bg-violet-800 shadow transition-all"
                title="Avaliação única com várias áreas e um só gabarito"
              >
                <Layers className="w-4 h-4" /> Criar Avaliação Geral
              </button>
              <button
                onClick={() => setShowNovaSoNota(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white rounded-xl text-xs font-bold hover:bg-indigo-800 shadow transition-all"
                title="Sem questões: só cria o campo de nota no diário dos professores escolhidos por cada área"
              >
                <FileSpreadsheet className="w-4 h-4" /> Nova Avaliação só de Nota
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowNovaModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 shadow transition-all"
            >
              <Plus className="w-4 h-4" /> Nova Avaliação da Área
            </button>
          )}
        </div>
      </div>

      {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
        </div>
      ) : lista.length === 0 ? (
        <div className="text-center py-12 bg-ms-card border border-gray-800 rounded-2xl p-6">
          <FileText className="w-12 h-12 text-ms-muted mx-auto mb-2 opacity-50" />
          <p className="text-ms-main font-bold text-sm">
            {grupo === 'GERAL' ? 'Nenhuma avaliação geral ainda.' : `Nenhuma avaliação da área de ${area} ainda.`}
          </p>
          <p className="text-xs text-ms-muted mt-1">Use o botão acima para criar a primeira.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lista.map((av) => {
            const geral = !!av.eh_prova_geral;
            const soNota = !!av.somente_nota;
            const areasGeral = av.areas ?? [];
            // Na geral, o card mostra só as cotas da área aberta; o andamento das outras
            // áreas aparece resumido nos selos de área.
            const cotas = (av.cotas || []).filter((c) => !geral || c.area_conhecimento === area);
            const totalPrevisto = geral
              ? areasGeral.reduce((s, a) => s + a.qtd_questoes, 0)
              : cotas.reduce((s, c) => s + c.qtd_questoes, 0);
            const totalInserido = geral
              ? areasGeral.reduce((s, a) => s + a.qtd_inserida, 0)
              : cotas.reduce((s, c) => s + c.qtd_inserida, 0);
            const todasPreenchidas = soNota
              ? areasGeral.length > 0 && areasGeral.every((a) => a.configurada)
              : geral
              ? areasGeral.length > 0 && areasGeral.every((a) => a.qtd_inserida === a.qtd_questoes)
              : totalPrevisto > 0 && totalInserido >= totalPrevisto;
            const podePublicar = todasPreenchidas && (!geral || !!av.criado_por_mim);
            const motivoNaoPublica = !todasPreenchidas
              ? soNota ? 'Aguardando todas as áreas escolherem quem recebe a nota' : geral ? 'Aguardando todas as áreas completarem as questões' : 'Aguardando preenchimento das cotas de questões'
              : 'Somente quem criou a avaliação geral pode publicá-la';
            const descricaoTipo = soNota
              ? 'Só nota (digitada pelo corretor)'
              : geral
              ? av.tipo === 'AVALIACAO'
                ? 'Avaliação com nota'
                : `Avaliação pública ${av.lancar_no_boletim ? 'com' : 'sem'} nota`
              : av.tipo === 'AVALIACAO' ? 'Avaliação com nota' : 'Simulado';

            const faixa = faixaDoTipo(av);

            return (
              <div key={av.id} className="bg-ms-card border border-gray-800 rounded-xl p-5 space-y-4">
                <div className={`-mx-5 -mt-5 px-5 py-2 rounded-t-xl flex items-center gap-2 text-white text-xs font-black uppercase tracking-wider ${faixa.cor}`}>
                  <faixa.Icone className="w-4 h-4 shrink-0" />
                  <span className="truncate">{faixa.rotulo}</span>
                </div>
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
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-ms-muted">{(av.turma_nomes?.length ?? 0) > 1 ? 'Turmas' : 'Turma'}:</span>
                      {(av.turma_nomes ?? []).length === 0 && <span className="text-xs text-ms-muted">—</span>}
                      {[...(av.turma_nomes ?? [])].sort().map((t) => (
                        <span key={t} className="px-2.5 py-1 rounded-lg bg-blue-700 text-white text-sm font-black shadow-sm">{t}</span>
                      ))}
                    </div>
                    <p className="text-xs text-ms-muted mt-1.5">
                      {descricaoTipo} · Valor {Number(av.valor_total).toFixed(2)} pts{soNota ? '' : ` · Modo ${av.modo}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {av.status !== 'PUBLICADA' && (
                      <button
                        onClick={() => handlePublicar(av)}
                        disabled={publicandoId === av.id || !podePublicar}
                        title={!podePublicar ? motivoNaoPublica : undefined}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold disabled:opacity-40 shadow-sm transition-colors"
                      >
                        {publicandoId === av.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Publicar e Sincronizar Notas
                      </button>
                    )}
                    {av.status === 'PUBLICADA' && (
                      <button
                        onClick={() => handleDespublicar(av)}
                        disabled={despublicandoId === av.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors disabled:opacity-40"
                        title="Volta pra rascunho e remove a nota do boletim de cada professor (só funciona se ninguém já respondeu/corrigiu)"
                      >
                        {despublicandoId === av.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                        Despublicar
                      </button>
                    )}
                    {geral && av.status !== 'PUBLICADA' && areasGeral.some((a) => a.area_conhecimento === area) && (
                      <button
                        onClick={() => setConfigurandoGeral(av)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 shadow-sm transition-colors"
                        title={soNota ? 'Escolher quem recebe a nota nesta área' : 'Escolher quem recebe a nota e quem insere as questões desta área'}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" /> Configurar {area}
                      </button>
                    )}
                    {geral && av.tipo === 'SIMULADO' && av.status === 'PUBLICADA' && av.token_publico && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(linkPublicoSimulado(av.token_publico!));
                          alert('Link da avaliação copiado. O aluno abre o link e digita o código do SGDE.');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" /> Copiar link da avaliação
                      </button>
                    )}
                    {av.status !== 'PUBLICADA' && (
                      <button
                        onClick={() => (geral ? setEditandoGeral(av) : setEditandoAvaliacao(av))}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                        title="Editar título, valor, datas, turmas e cotas da avaliação"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                    )}
                    <button
                      onClick={() => setCorretoresDe(av)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                      title="Escolher o professor que corrige/lança a nota de cada turma — os demais só veem a nota"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Corretores{av.corretores?.length ? ` (${av.corretores.length})` : ''}
                    </button>
                    {av.status === 'PUBLICADA' && (
                      <button
                        onClick={() => setNotasDe(av)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                        title="Conferir e alterar as notas por turma"
                      >
                        <ClipboardList className="w-3.5 h-3.5" /> Notas
                      </button>
                    )}
                    {!soNota && (
                    <>
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
                    <button
                      onClick={() => setConfigImpressaoDe(av)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                      title="Embaralhamento, versões e cartão-resposta — funciona mesmo já publicada"
                    >
                      <Settings className="w-3.5 h-3.5" /> Config. impressão
                    </button>
                    {av.status === 'PUBLICADA' && (
                      <button
                        onClick={() => setResultadosDe(av)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-ms-main rounded-lg text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" /> Resultados
                      </button>
                    )}
                    </>
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
                    <span>{soNota ? 'Áreas e professores que recebem a nota' : 'Acompanhamento das Cotas por Docente'}</span>
                    {!soNota && (
                    <span className={todasPreenchidas ? 'text-emerald-400' : 'text-amber-400'}>
                      {totalInserido} de {totalPrevisto} questões inseridas
                    </span>
                    )}
                  </div>

                  {!soNota && (
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
                  )}

                  {geral && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {areasGeral.map((a) => {
                        const completa = soNota ? a.configurada : a.qtd_inserida === a.qtd_questoes;
                        return (
                          <span
                            key={a.area_conhecimento}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              completa
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            } ${a.area_conhecimento === area ? 'ring-2 ring-ms-blueText' : ''}`}
                            title={a.configurada ? 'Área já configurada pelo PCA' : 'O PCA desta área ainda não configurou'}
                          >
                            {a.area_conhecimento}{soNota ? '' : `: ${a.qtd_inserida}/${a.qtd_questoes}`}
                            {!a.configurada && ' · aguardando PCA'}
                            {soNota && a.configurada && ` · ${(av.notas_professores ?? []).filter((n) => n.area_conhecimento === a.area_conhecimento).length} prof.`}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {geral && !soNota && cotas.length === 0 && areasGeral.some((a) => a.area_conhecimento === area && a.qtd_inserida < a.qtd_questoes) && (
                    <p className="text-[11px] text-ms-muted">
                      Nenhum professor de {area} com cota ainda. Use "Configurar {area}" para distribuir as questões ou sortear.
                    </p>
                  )}

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

      {showNovaGeral && (
        <NovaAvaliacaoGeralModal
          onClose={() => setShowNovaGeral(false)}
          onCriada={() => {
            setShowNovaGeral(false);
            carregar();
          }}
        />
      )}

      {showNovaSoNota && (
        <NovaAvaliacaoGeralModal
          somenteNota
          onClose={() => setShowNovaSoNota(false)}
          onCriada={() => {
            setShowNovaSoNota(false);
            carregar();
          }}
        />
      )}

      {corretoresDe && (
        <CorretoresModal
          avaliacao={corretoresDe}
          onClose={() => setCorretoresDe(null)}
          onSalvo={() => {
            setCorretoresDe(null);
            carregar();
          }}
        />
      )}

      {notasDe && <NotasTurmaModal avaliacao={notasDe} onClose={() => setNotasDe(null)} />}

      {editandoGeral && (
        <NovaAvaliacaoGeralModal
          avaliacaoExistente={editandoGeral}
          onClose={() => setEditandoGeral(null)}
          onCriada={() => {
            setEditandoGeral(null);
            carregar();
          }}
        />
      )}

      {configurandoGeral && (
        <ConfigurarAreaGeralModal
          avaliacao={configurandoGeral}
          area={area}
          onClose={() => setConfigurandoGeral(null)}
          onSalvo={() => {
            setConfigurandoGeral(null);
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

      {configImpressaoDe && (
        <ConfigImpressaoAreaModal
          avaliacao={configImpressaoDe}
          onClose={() => setConfigImpressaoDe(null)}
          onSalvo={carregar}
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

type GrupoAvaliacao = 'GERAL' | 'AREA';

