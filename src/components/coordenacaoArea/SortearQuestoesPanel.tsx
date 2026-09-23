import { useEffect, useState } from 'react';
import { Dices, Loader2, X } from 'lucide-react';
import type { FilterOptions, Question } from '../../types/bancoQuestoes';
import type { AreaConhecimento } from '../../utils/areasConhecimento';
import { disciplinaPertenceAAreaEstrita } from '../../utils/areasConhecimento';
import { buscarAssuntosPorDisciplina, buscarFilterOptions, buscarTopicosPorAssunto } from '../../services/bancoQuestoesService';
import { sortearQuestoes } from '../../services/avaliacoesService';

interface Props {
  area: AreaConhecimento;
  /** Máximo que pode ser sorteado aqui (o que sobra da área). */
  qtdMaxima: number;
  /** Questões que já estão em outra parte da prova e não podem sair de novo. */
  excluir: string[];
  sorteadas: Question[];
  onChange: (questoes: Question[]) => void;
}

const selectClass =
  'w-full px-3 py-2 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-800 rounded-xl text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';

function resumo(q: Question): string {
  const texto = (q.statement || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return texto.length > 140 ? `${texto.slice(0, 140)}…` : texto;
}

// Filtros opcionais (disciplina, assunto, tópico, banca); só a quantidade é obrigatória.
export function SortearQuestoesPanel({ area, qtdMaxima, excluir, sorteadas, onChange }: Props) {
  const [opcoes, setOpcoes] = useState<FilterOptions | null>(null);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [assuntos, setAssuntos] = useState<string[]>([]);
  const [topicos, setTopicos] = useState<string[]>([]);
  const [assunto, setAssunto] = useState('');
  const [topico, setTopico] = useState('');
  const [banca, setBanca] = useState('');
  const [qtd, setQtd] = useState(Math.max(1, qtdMaxima));
  const [sorteando, setSorteando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    buscarFilterOptions().then(setOpcoes).catch(() => setOpcoes(null));
  }, []);

  useEffect(() => {
    setQtd((atual) => Math.min(Math.max(1, atual), Math.max(1, qtdMaxima)));
  }, [qtdMaxima]);

  // Assuntos da disciplina quando só uma está marcada; senão, a lista geral.
  useEffect(() => {
    setAssunto('');
    if (disciplinas.length === 1) {
      buscarAssuntosPorDisciplina(disciplinas[0]).then(setAssuntos).catch(() => setAssuntos([]));
    } else {
      setAssuntos(opcoes?.assuntos ?? []);
    }
  }, [disciplinas, opcoes]);

  useEffect(() => {
    setTopico('');
    if (!assunto) { setTopicos([]); return; }
    buscarTopicosPorAssunto(assunto).then(setTopicos).catch(() => setTopicos([]));
  }, [assunto]);

  const disciplinasDaArea = (opcoes?.disciplines ?? []).filter((d) => disciplinaPertenceAAreaEstrita(d, area));

  function toggleDisciplina(d: string) {
    setDisciplinas((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function sortear() {
    if (qtd < 1 || qtd > qtdMaxima) {
      setAviso(`Informe uma quantidade entre 1 e ${qtdMaxima}.`);
      return;
    }
    setSorteando(true);
    setAviso(null);
    try {
      // Nenhuma marcada = todas as disciplinas DA ÁREA (não o banco inteiro).
      const filtroDisciplinas = disciplinas.length > 0 ? disciplinas : disciplinasDaArea;
      const resultado = await sortearQuestoes({ qtd, disciplinas: filtroDisciplinas, assunto, topico, banca, excluir });
      onChange(resultado);
      if (resultado.length < qtd) {
        setAviso(`Só ${resultado.length} questão(ões) encontrada(s) com esses filtros (pedido: ${qtd}). Afrouxe os filtros ou complete com outra fonte.`);
      }
    } catch (e: any) {
      setAviso(e.message || 'Erro ao sortear questões.');
    } finally {
      setSorteando(false);
    }
  }

  return (
    <div className="space-y-3 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-ms-dark/40">
      <div>
        <p className="text-xs font-bold text-ms-muted mb-1">Disciplinas (opcional — nenhuma marcada = todas da área)</p>
        <div className="flex flex-wrap gap-1.5">
          {disciplinasDaArea.length === 0 && <span className="text-xs text-ms-muted">Carregando...</span>}
          {disciplinasDaArea.map((d) => {
            const sel = disciplinas.includes(d);
            return (
              <button
                type="button"
                key={d}
                onClick={() => toggleDisciplina(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  sel ? 'bg-ms-blue text-white border-ms-blue' : 'bg-white dark:bg-ms-dark text-ms-main border-gray-300 dark:border-gray-700'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
        <select className={selectClass} value={assunto} onChange={(e) => setAssunto(e.target.value)}>
          <option value="">Assunto (opcional)</option>
          {assuntos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={selectClass} value={topico} onChange={(e) => setTopico(e.target.value)} disabled={!assunto}>
          <option value="">{assunto ? 'Tópico (opcional)' : 'Tópico (escolha o assunto)'}</option>
          {topicos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={selectClass} value={banca} onChange={(e) => setBanca(e.target.value)}>
          <option value="">Banca (opcional)</option>
          {(opcoes?.bancas ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={qtdMaxima}
            value={qtd}
            onChange={(e) => setQtd(Number(e.target.value))}
            className={`${selectClass} !w-20 shrink-0 text-center font-bold`}
            title="Quantidade de questões (obrigatório)"
          />
          <button
            type="button"
            onClick={sortear}
            disabled={sorteando || qtdMaxima < 1}
            className="flex items-center gap-1.5 px-3 py-2 bg-ms-blue text-white rounded-xl text-xs font-bold hover:bg-blue-600 disabled:opacity-40 whitespace-nowrap"
          >
            {sorteando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Dices className="w-3.5 h-3.5" />}
            {sorteadas.length > 0 ? 'Sortear de novo' : 'Sortear'}
          </button>
        </div>
      </div>

      {aviso && <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{aviso}</p>}

      {sorteadas.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-ms-muted">{sorteadas.length} questão(ões) sorteada(s)</p>
            <button type="button" onClick={() => onChange([])} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline">
              Limpar
            </button>
          </div>
          <ol className="max-h-56 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-ms-card">
            {sorteadas.map((q, i) => (
              <li key={q.id} className="flex items-start gap-2 px-2.5 py-1.5 text-xs">
                <span className="font-bold text-ms-muted w-5 shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-ms-blueText">{q.discipline}</span>
                  {q.assunto ? <span className="text-ms-muted"> · {q.assunto}</span> : null}
                  <p className="text-ms-main">{resumo(q)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(sorteadas.filter((x) => x.id !== q.id))}
                  className="text-ms-muted hover:text-red-500 shrink-0"
                  title="Tirar esta questão"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
