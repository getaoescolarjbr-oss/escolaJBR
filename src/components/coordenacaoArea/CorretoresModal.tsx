import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, UserCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AvaliacaoArea } from '../../types/avaliacoes';
import { definirCorretores } from '../../services/avaliacoesService';

interface Props {
  avaliacao: AvaliacaoArea;
  onClose: () => void;
  onSalvo: () => void;
}

interface Opcao {
  professor_id: string;
  professor_nome: string;
}

// Corretor por turma: só ele (e a coordenação) altera a nota daquela turma; os demais
// professores que recebem a nota só a veem. Vale para avaliação de área, geral e geral
// só de nota — a regra fica no banco (add_corretores_e_avaliacao_somente_nota.sql).
export function CorretoresModal({ avaliacao, onClose, onSalvo }: Props) {
  const turmaIds = useMemo(() => avaliacao.turma_ids ?? [], [avaliacao.turma_ids]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  // Na geral, o campo de nota só existe nas turmas em que o professor dá aula.
  const [alocacoes, setAlocacoes] = useState<Set<string>>(new Set());
  const [escolha, setEscolha] = useState<Record<string, string>>(() =>
    Object.fromEntries((avaliacao.corretores ?? []).map((c) => [c.turma_id, c.professor_id]))
  );
  const [todas, setTodas] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quem pode ser corretor: quem recebe a nota desta avaliação.
  const recebem = useMemo<Opcao[]>(() => {
    const fonte = avaliacao.eh_prova_geral ? avaliacao.notas_professores ?? [] : avaliacao.cotas ?? [];
    const mapa = new Map<string, Opcao>();
    for (const p of fonte) {
      if (!mapa.has(p.professor_id)) mapa.set(p.professor_id, { professor_id: p.professor_id, professor_nome: p.professor_nome ?? '' });
    }
    return Array.from(mapa.values()).sort((a, b) => a.professor_nome.localeCompare(b.professor_nome));
  }, [avaliacao]);

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

  const opcoesDaTurma = (turmaId: string) =>
    avaliacao.eh_prova_geral ? recebem.filter((p) => alocacoes.has(`${p.professor_id}|${turmaId}`)) : recebem;

  function aplicarATodas(professorId: string) {
    setTodas(professorId);
    if (!professorId) return;
    setEscolha((prev) => {
      const novo = { ...prev };
      for (const t of turmas) {
        if (opcoesDaTurma(t.id).some((p) => p.professor_id === professorId)) novo[t.id] = professorId;
      }
      return novo;
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await definirCorretores(
        avaliacao.id,
        turmas.map((t) => ({ turma_id: t.id, professor_id: escolha[t.id] || null }))
      );
      onSalvo();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar os corretores.');
    } finally {
      setSalvando(false);
    }
  }

  const selectClass =
    'w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';

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

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
            </div>
          ) : recebem.length === 0 ? (
            <p className="text-sm text-ms-muted text-center py-8">
              Ninguém recebe a nota desta avaliação ainda.{' '}
              {avaliacao.eh_prova_geral ? 'Cada coordenador de área escolhe isso em "Configurar".' : 'Inclua professores nas cotas.'}
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-ms-muted mb-1">Mesmo corretor para várias turmas</label>
                <select value={todas} onChange={(e) => aplicarATodas(e.target.value)} className={selectClass}>
                  <option value="">Escolha para aplicar em todas as turmas em que ele recebe a nota...</option>
                  {recebem.map((p) => (
                    <option key={p.professor_id} value={p.professor_id}>{p.professor_nome}</option>
                  ))}
                </select>
              </div>

              <div className="border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-800">
                {turmas.map((t) => {
                  const opcoes = opcoesDaTurma(t.id);
                  return (
                    <div key={t.id} className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-center px-3 py-2.5">
                      <span className="text-sm font-bold text-ms-main">{t.nome}</span>
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
            disabled={salvando || loading || recebem.length === 0}
            onClick={salvar}
            className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40 shadow transition-all"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar corretores
          </button>
        </div>
      </div>
    </div>
  );
}
