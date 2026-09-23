import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, UserCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AvaliacaoArea } from '../../types/avaliacoes';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { definirCorretores, definirDistribuicaoCorrecao } from '../../services/avaliacoesService';

interface Props {
  avaliacao: AvaliacaoArea;
  /** Área aberta no painel (a do coordenador). */
  area: AreaConhecimento;
  onClose: () => void;
  onSalvo: () => void;
}

interface Opcao {
  professor_id: string;
  professor_nome: string;
  area_conhecimento: string | null;
}

// Corretor por turma: só ele (e a coordenação) altera a nota daquela turma; os demais
// professores que recebem a nota só a veem. A regra fica no banco.
//
// Avaliação geral, em duas etapas:
//   1. quem criou (o "dono") escolhe qual ÁREA corrige cada turma;
//   2. o coordenador de cada área escolhe, entre os professores da área que recebem a
//      nota, o corretor das turmas que a área recebeu. As turmas das outras áreas
//      aparecem só para consulta — ele não consegue trocar o corretor delas.
// Avaliação de área: o coordenador da área escolhe o corretor de todas as turmas.
export function CorretoresModal({ avaliacao, area, onClose, onSalvo }: Props) {
  const geral = !!avaliacao.eh_prova_geral;
  const dono = !geral || avaliacao.sou_dono !== false;
  const turmaIds = useMemo(() => avaliacao.turma_ids ?? [], [avaliacao.turma_ids]);
  const areasDaProva = useMemo(() => (avaliacao.areas ?? []).map((a) => a.area_conhecimento), [avaliacao.areas]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  // O campo de nota só existe nas turmas em que o professor dá aula.
  const [alocacoes, setAlocacoes] = useState<Set<string>>(new Set());
  const [areaDaTurma, setAreaDaTurma] = useState<Record<string, string>>(() =>
    Object.fromEntries((avaliacao.correcao_areas ?? []).map((c) => [c.turma_id, c.area_conhecimento]))
  );
  const [escolha, setEscolha] = useState<Record<string, string>>(() =>
    Object.fromEntries((avaliacao.corretores ?? []).map((c) => [c.turma_id, c.professor_id]))
  );
  const [todas, setTodas] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quem pode ser corretor: quem recebe a nota desta avaliação.
  const recebem = useMemo<Opcao[]>(() => {
    const usaNotas = geral || avaliacao.somente_nota;
    const mapa = new Map<string, Opcao>();
    if (usaNotas) {
      for (const p of avaliacao.notas_professores ?? []) {
        const k = `${p.professor_id}|${p.area_conhecimento}`;
        if (!mapa.has(k)) mapa.set(k, { professor_id: p.professor_id, professor_nome: p.professor_nome ?? '', area_conhecimento: p.area_conhecimento });
      }
    } else {
      for (const c of avaliacao.cotas ?? []) {
        if (!mapa.has(c.professor_id)) mapa.set(c.professor_id, { professor_id: c.professor_id, professor_nome: c.professor_nome ?? '', area_conhecimento: null });
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.professor_nome.localeCompare(b.professor_nome));
  }, [avaliacao, geral]);

  useEffect(() => {
    (async () => {
      try {
        if (turmaIds.length === 0) return;
        const [{ data: t }, { data: al }] = await Promise.all([
          supabase.from('turmas').select('id, nome').in('id', turmaIds).order('nome'),
          supabase.from('alocacoes_v2').select('professor_id, turma_id').in('turma_id', turmaIds),
        ]);
        setTurmas((t ?? []) as { id: string; nome: string }[]);
        setAlocacoes(new Set(((al ?? []) as { professor_id: string; turma_id: string }[]).map((a) => `${a.professor_id}|${a.turma_id}`)));
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar as turmas.');
      } finally {
        setLoading(false);
      }
    })();
  }, [turmaIds]);

  // Pode escolher o corretor desta turma? Dono: todas. PCA: só as que a área dele recebeu.
  const podeEditarTurma = (turmaId: string) => dono || areaDaTurma[turmaId] === area;

  const opcoesDaTurma = (turmaId: string) => {
    if (!geral) return recebem.filter((p, i, arr) => arr.findIndex((x) => x.professor_id === p.professor_id) === i);
    const areaT = areaDaTurma[turmaId];
    const lista = recebem.filter(
      (p) => alocacoes.has(`${p.professor_id}|${turmaId}`) && (!areaT || p.area_conhecimento === areaT)
    );
    return lista.filter((p, i, arr) => arr.findIndex((x) => x.professor_id === p.professor_id) === i);
  };

  const turmasEditaveis = turmas.filter((t) => podeEditarTurma(t.id));
  const opcoesAplicarTodas = useMemo(() => {
    const mapa = new Map<string, Opcao>();
    for (const t of turmasEditaveis) for (const p of opcoesDaTurma(t.id)) mapa.set(p.professor_id, p);
    return Array.from(mapa.values()).sort((a, b) => a.professor_nome.localeCompare(b.professor_nome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmas, areaDaTurma, alocacoes, recebem]);

  function aplicarATodas(professorId: string) {
    setTodas(professorId);
    if (!professorId) return;
    setEscolha((prev) => {
      const novo = { ...prev };
      for (const t of turmasEditaveis) {
        if (opcoesDaTurma(t.id).some((p) => p.professor_id === professorId)) novo[t.id] = professorId;
      }
      return novo;
    });
  }

  function mudarAreaDaTurma(turmaId: string, novaArea: string) {
    setAreaDaTurma((prev) => ({ ...prev, [turmaId]: novaArea }));
    // O corretor escolhido precisa ser da área que corrige; se não for, limpa.
    setEscolha((prev) => {
      const atual = prev[turmaId];
      if (!atual || !novaArea) return prev;
      const ehDaArea = recebem.some((p) => p.professor_id === atual && p.area_conhecimento === novaArea);
      return ehDaArea ? prev : { ...prev, [turmaId]: '' };
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (geral && dono) {
        await definirDistribuicaoCorrecao(
          avaliacao.id,
          turmas.map((t) => ({ turma_id: t.id, area: areaDaTurma[t.id] || null }))
        );
      }
      await definirCorretores(
        avaliacao.id,
        turmasEditaveis.map((t) => ({ turma_id: t.id, professor_id: escolha[t.id] || null }))
      );
      onSalvo();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar os corretores.');
    } finally {
      setSalvando(false);
    }
  }

  const nomeProfessor = (id?: string) => recebem.find((p) => p.professor_id === id)?.professor_nome
    ?? (avaliacao.corretores ?? []).find((c) => c.professor_id === id)?.professor_nome ?? '';

  const selectClass =
    'w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';

  const nadaParaMim = geral && !dono && turmasEditaveis.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-ms-blueText" /> Corretores por turma
            </h2>
            <p className="text-xs text-ms-muted">
              {avaliacao.titulo} · Só o corretor da turma (e a coordenação) lança e altera a nota. Os demais professores que
              recebem a nota apenas a veem no diário.
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && (
            <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {geral && (
            <p className="text-xs text-ms-muted leading-relaxed bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-xl p-3">
              {dono
                ? <>Você criou esta avaliação: escolha <b>qual área corrige cada turma</b>. Depois, o coordenador de cada área escolhe o professor corretor das turmas que recebeu (você também pode escolher aqui).</>
                : <>Quem criou a avaliação define qual área corrige cada turma. Você escolhe o corretor só das turmas que ficaram com <b>{area}</b>; as demais aparecem só para consulta.</>}
            </p>
          )}

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
            </div>
          ) : recebem.length === 0 && !(geral && dono) ? (
            <p className="text-sm text-ms-muted text-center py-8">
              Ninguém recebe a nota desta avaliação ainda.{' '}
              {geral ? 'Cada coordenador de área escolhe isso em "Configurar".' : avaliacao.somente_nota ? 'Escolha em "Editar".' : 'Inclua professores nas cotas.'}
            </p>
          ) : (
            <>
              {nadaParaMim && (
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3">
                  Nenhuma turma desta avaliação ficou com {area} para corrigir
                  {Object.keys(areaDaTurma).length === 0 ? ' — quem criou ainda não distribuiu as turmas entre as áreas.' : '.'}
                </p>
              )}

              {turmasEditaveis.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-ms-muted mb-1">Mesmo corretor para várias turmas</label>
                  <select value={todas} onChange={(e) => aplicarATodas(e.target.value)} className={selectClass}>
                    <option value="">Escolha para aplicar em todas as suas turmas em que ele recebe a nota...</option>
                    {opcoesAplicarTodas.map((p) => (
                      <option key={p.professor_id} value={p.professor_id}>{p.professor_nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-800">
                {geral && (
                  <div className={`hidden sm:grid gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-ms-muted ${dono ? 'grid-cols-[110px_1fr_1fr]' : 'grid-cols-[110px_1fr]'}`}>
                    <span>Turma</span>
                    {dono && <span>Área que corrige</span>}
                    <span>Professor corretor</span>
                  </div>
                )}
                {turmas.map((t) => {
                  const editavel = podeEditarTurma(t.id);
                  const areaT = areaDaTurma[t.id];
                  const opcoes = opcoesDaTurma(t.id);
                  return (
                    <div
                      key={t.id}
                      className={`grid grid-cols-1 gap-2 items-center px-3 py-2.5 ${
                        geral && dono ? 'sm:grid-cols-[110px_1fr_1fr]' : 'sm:grid-cols-[110px_1fr]'
                      } ${editavel ? '' : 'bg-gray-50 dark:bg-ms-dark/40'}`}
                    >
                      <span className="text-sm font-bold text-ms-main">{t.nome}</span>
                      {geral && dono && (
                        <select value={areaT ?? ''} onChange={(e) => mudarAreaDaTurma(t.id, e.target.value)} className={selectClass}>
                          <option value="">Nenhuma área (eu escolho o corretor)</option>
                          {areasDaProva.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      )}
                      {editavel ? (
                        <select
                          value={escolha[t.id] ?? ''}
                          onChange={(e) => setEscolha((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          className={selectClass}
                        >
                          <option value="">Sem corretor — todos que recebem a nota podem alterar</option>
                          {opcoes.map((p) => (
                            <option key={p.professor_id} value={p.professor_id}>{p.professor_nome}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-ms-muted">
                          {areaT ? <>Corrigida por <b className="text-ms-main">{areaT}</b></> : 'Ainda sem área'}
                          {' · '}
                          {escolha[t.id] ? <>corretor: <b className="text-ms-main">{nomeProfessor(escolha[t.id])}</b></> : 'corretor não definido'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-ms-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || loading || (recebem.length === 0 && !(geral && dono)) || nadaParaMim}
            onClick={salvar}
            className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40 shadow transition-all"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {geral && dono ? 'Salvar distribuição e corretores' : 'Salvar corretores'}
          </button>
        </div>
      </div>
    </div>
  );
}
