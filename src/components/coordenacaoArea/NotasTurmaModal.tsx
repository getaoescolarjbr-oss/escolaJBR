import { useEffect, useState } from 'react';
import { AlertCircle, Check, ClipboardList, Loader2, Lock, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AvaliacaoArea, NotaAlunoTurma } from '../../types/avaliacoes';
import { lancarNotaManual, listarNotasAvaliacaoTurma } from '../../services/avaliacoesService';

interface Props {
  avaliacao: AvaliacaoArea;
  onClose: () => void;
}

// Notas de uma turma numa avaliação publicada, para a coordenação (que altera qualquer
// nota) ou o corretor da turma. Gravar num campo copia a nota para o diário de todos os
// professores que a recebem.
export function NotasTurmaModal({ avaliacao, onClose }: Props) {
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [linhas, setLinhas] = useState<NotaAlunoTurma[]>([]);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [salvandoAluno, setSalvandoAluno] = useState<string | null>(null);
  const [salvoAluno, setSalvoAluno] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const ids = avaliacao.turma_ids ?? [];
    if (ids.length === 0) return;
    supabase
      .from('turmas')
      .select('id, nome')
      .in('id', ids)
      .order('nome')
      .then(({ data }) => {
        const lista = (data ?? []) as { id: string; nome: string }[];
        setTurmas(lista);
        if (lista.length > 0) setTurmaId(lista[0].id);
      });
  }, [avaliacao.turma_ids]);

  useEffect(() => {
    if (!turmaId) return;
    setLoading(true);
    setErro(null);
    listarNotasAvaliacaoTurma(avaliacao.id, turmaId)
      .then((l) => {
        setLinhas(l);
        setRascunho(Object.fromEntries(l.map((x) => [x.aluno_id, x.nota === null ? '' : String(x.nota)])));
      })
      .catch((e) => setErro(e.message || 'Erro ao carregar as notas.'))
      .finally(() => setLoading(false));
  }, [avaliacao.id, turmaId]);

  async function salvar(linha: NotaAlunoTurma) {
    const texto = (rascunho[linha.aluno_id] ?? '').replace(',', '.').trim();
    const nota = texto === '' ? null : Number(texto);
    if (nota !== null && (Number.isNaN(nota) || nota < 0)) {
      setErro(`Nota inválida para ${linha.aluno_nome}.`);
      return;
    }
    if (nota === linha.nota) return;
    setSalvandoAluno(linha.aluno_id);
    setErro(null);
    try {
      try {
        await lancarNotaManual(linha.avaliacao_id, linha.aluno_id, nota);
      } catch (e: any) {
        const m = (e?.message || '').match(/^CONFIRMACAO_SUBSTITUICAO:(\d+)/);
        if (!m) throw e;
        if (!window.confirm(`${m[1]} professor(es) já tinha(m) outra nota lançada para ${linha.aluno_nome}. Substituir?`)) {
          setRascunho((prev) => ({ ...prev, [linha.aluno_id]: linha.nota === null ? '' : String(linha.nota) }));
          return;
        }
        await lancarNotaManual(linha.avaliacao_id, linha.aluno_id, nota, true);
      }
      const final = nota === null ? null : Math.min(nota, linha.valor_maximo);
      setLinhas((prev) => prev.map((x) => (x.aluno_id === linha.aluno_id ? { ...x, nota: final } : x)));
      setRascunho((prev) => ({ ...prev, [linha.aluno_id]: final === null ? '' : String(final) }));
      setSalvoAluno(linha.aluno_id);
      setTimeout(() => setSalvoAluno((a) => (a === linha.aluno_id ? null : a)), 1500);
    } catch (e: any) {
      setErro((e?.message || 'Erro ao salvar a nota.').replace(/^NOTA_BLOQUEADA:\s*/, ''));
    } finally {
      setSalvandoAluno(null);
    }
  }

  const corretor = avaliacao.corretores?.find((c) => c.turma_id === turmaId);
  const inativo = (s: string | null) => !!s && s !== 'Ativo';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-ms-main flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-ms-blueText" /> Notas — {avaliacao.titulo}
            </h2>
            <p className="text-xs text-ms-muted">
              Valor {Number(avaliacao.valor_total).toFixed(2)} pts · A nota salva aqui vai para o diário de todos os professores
              que a recebem nesta turma.
            </p>
          </div>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4 flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-ms-muted">Turma</label>
          <select
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm font-bold text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          >
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
          <span className="text-xs text-ms-muted">
            Corretor: <strong className="text-ms-main">{corretor?.professor_nome ?? 'não definido (todos que recebem podem alterar)'}</strong>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
          ) : linhas.length === 0 ? (
            <p className="text-sm text-ms-muted text-center py-8">
              Nenhum campo de nota nesta turma. A avaliação precisa estar publicada, com professores recebendo a nota.
            </p>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-800">
              {linhas.map((l, i) => (
                <div key={l.aluno_id} className={`flex items-center justify-between gap-3 px-3 py-2 ${inativo(l.status) ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ms-main truncate">
                      <span className="text-ms-muted mr-1.5">{l.aluno_numero ?? i + 1}.</span>
                      {l.aluno_nome}
                    </p>
                    {inativo(l.status) && <p className="text-[11px] text-ms-muted">{l.status}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {salvandoAluno === l.aluno_id && <Loader2 className="w-4 h-4 animate-spin text-ms-blueText" />}
                    {salvoAluno === l.aluno_id && <Check className="w-4 h-4 text-emerald-600" />}
                    {!l.pode_editar && <Lock className="w-4 h-4 text-ms-muted" />}
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!l.pode_editar}
                      value={rascunho[l.aluno_id] ?? ''}
                      onChange={(e) => setRascunho((prev) => ({ ...prev, [l.aluno_id]: e.target.value }))}
                      onBlur={() => salvar(l)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      placeholder="—"
                      className="w-20 px-2 py-1.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-bold text-center text-ms-main outline-none focus:ring-2 focus:ring-ms-blue disabled:opacity-50"
                    />
                    <span className="text-xs text-ms-muted w-12">/ {Number(l.valor_maximo).toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-ms-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
