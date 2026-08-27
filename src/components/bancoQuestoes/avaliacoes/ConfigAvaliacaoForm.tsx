import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Question } from '../../../types/bancoQuestoes';
import type { ModoAvaliacao, NovaAvaliacaoInput } from '../../../types/avaliacoes';
import { listarTurmas } from '../../../services/agendamentoService';
import { listarDisciplinasCatalogo } from '../../../services/avaliacoesService';
import { getBimestreFromDate } from '../../../utils/academicUtils';

const BIMESTRES = [1, 2, 3, 4] as const;

const inputClass =
  'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue';

interface Props {
  questoes: Question[];
  onVoltar: () => void;
  onContinuar: (
    config: Omit<NovaAvaliacaoInput, 'questoes'>,
    valoresPorQuestao: Record<string, number>,
    turmaNomes: string[]
  ) => void;
}

// Passo 2 do gerador: configura a avaliação (valor total dividido automaticamente entre as
// questões selecionadas, mas editável por questão), turma(s) alvo e modo de aplicação.
export function ConfigAvaliacaoForm({ questoes, onVoltar, onContinuar }: Props) {
  const [titulo, setTitulo] = useState('Avaliação');
  const [disciplinas, setDisciplinas] = useState<{ id: string; nome: string }[]>([]);
  const [disciplinaId, setDisciplinaId] = useState<string>('');
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(true);
  const [instrucoes, setInstrucoes] = useState('Leia atentamente cada questão antes de responder. Use caneta azul ou preta.');
  const [valorTotal, setValorTotal] = useState(10);
  const [valoresPorQuestao, setValoresPorQuestao] = useState<Record<string, number>>({});
  const [modo, setModo] = useState<ModoAvaliacao>('IMPRESSA');
  const [dataAplicacao, setDataAplicacao] = useState(() => new Date().toISOString().slice(0, 10));
  const [bimestreId, setBimestreId] = useState<number>(() => getBimestreFromDate(new Date().toISOString().slice(0, 10)) ?? 1);
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [turmaIds, setTurmaIds] = useState<Set<string>>(new Set());
  const [loadingTurmas, setLoadingTurmas] = useState(true);

  useEffect(() => {
    listarTurmas().then(setTurmas).catch(() => setTurmas([])).finally(() => setLoadingTurmas(false));
  }, []);

  useEffect(() => {
    listarDisciplinasCatalogo()
      .then((lista) => {
        setDisciplinas(lista);
        const assuntoQuestoes = Array.from(new Set(questoes.map((q) => q.discipline)))[0];
        const sugestao = assuntoQuestoes
          ? lista.find((d) => d.nome.toLowerCase() === assuntoQuestoes.toLowerCase())
          : undefined;
        if (sugestao) setDisciplinaId(sugestao.id);
      })
      .catch(() => setDisciplinas([]))
      .finally(() => setLoadingDisciplinas(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sugerido = getBimestreFromDate(dataAplicacao);
    if (sugerido) setBimestreId(sugerido);
  }, [dataAplicacao]);

  // Redistribui igualmente sempre que o valor total ou a lista de questões muda — o
  // professor pode sobrescrever valores individuais depois, mas eles são recalculados se o
  // valor total for alterado de novo (evita inconsistência de soma).
  useEffect(() => {
    const valorPorQuestao = questoes.length > 0 ? Math.round((valorTotal / questoes.length) * 100) / 100 : 0;
    setValoresPorQuestao(Object.fromEntries(questoes.map((q) => [q.id, valorPorQuestao])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorTotal, questoes.length]);

  const somaValores = useMemo(
    () => Object.values(valoresPorQuestao).reduce((soma, v) => soma + (v || 0), 0),
    [valoresPorQuestao]
  );

  function toggleTurma(id: string) {
    setTurmaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const precisaOnline = modo === 'ONLINE' || modo === 'AMBAS';
  const podeContinuar = titulo.trim().length > 0 && !!disciplinaId && turmaIds.size > 0 && (!precisaOnline || prazoEntrega);

  function handleContinuar() {
    const turmaNomes = turmas.filter((t) => turmaIds.has(t.id)).map((t) => t.nome);
    const disciplinaSelecionada = disciplinas.find((d) => d.id === disciplinaId);
    onContinuar(
      {
        titulo: titulo.trim(),
        disciplina: disciplinaSelecionada?.nome ?? '',
        disciplinaId: disciplinaSelecionada?.id ?? null,
        bimestreId,
        instrucoes: instrucoes.trim(),
        valorTotal,
        modo,
        dataAplicacao: dataAplicacao || null,
        prazoEntrega: precisaOnline && prazoEntrega ? new Date(prazoEntrega).toISOString() : null,
        turmaIds: Array.from(turmaIds),
      },
      valoresPorQuestao,
      turmaNomes
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-ms-muted">Título *</label>
            <input className={inputClass} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Avaliação / Prova / Simulado" />
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Disciplina *</label>
            <select className={inputClass} value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} disabled={loadingDisciplinas}>
              <option value="">{loadingDisciplinas ? 'Carregando...' : 'Selecione...'}</option>
              {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Bimestre *</label>
            <select className={inputClass} value={bimestreId} onChange={(e) => setBimestreId(Number(e.target.value))}>
              {BIMESTRES.map((b) => <option key={b} value={b}>{b}º Bimestre</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Valor total</label>
            <input
              type="number"
              step="0.1"
              min={0}
              className={inputClass}
              value={valorTotal}
              onChange={(e) => setValorTotal(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Modo de aplicação</label>
            <select className={inputClass} value={modo} onChange={(e) => setModo(e.target.value as ModoAvaliacao)}>
              <option value="IMPRESSA">Só impressa</option>
              <option value="ONLINE">Só online</option>
              <option value="AMBAS">Impressa e online</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Data de aplicação</label>
            <input type="date" className={inputClass} value={dataAplicacao} onChange={(e) => setDataAplicacao(e.target.value)} />
          </div>
          {precisaOnline && (
            <div>
              <label className="text-xs font-bold text-ms-muted">Prazo de entrega (online) *</label>
              <input type="datetime-local" className={inputClass} value={prazoEntrega} onChange={(e) => setPrazoEntrega(e.target.value)} />
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-bold text-ms-muted">Instruções (opcional)</label>
            <textarea className={inputClass} rows={2} value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-ms-main">Turma(s) que vão receber esta avaliação *</p>
          <p className="text-xs text-ms-muted">{turmaIds.size} selecionada(s)</p>
        </div>
        {loadingTurmas ? (
          <Loader2 className="w-5 h-5 animate-spin text-ms-blue" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {turmas.map((t) => (
              <label key={t.id} className="flex items-center gap-2 px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main cursor-pointer">
                <input type="checkbox" checked={turmaIds.has(t.id)} onChange={() => toggleTurma(t.id)} />
                {t.nome}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-ms-main">Valor por questão</p>
          <p className={`text-xs font-bold ${Math.abs(somaValores - valorTotal) > 0.01 ? 'text-amber-400' : 'text-ms-muted'}`}>
            Soma: {somaValores.toFixed(2)} / {valorTotal.toFixed(2)}
          </p>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {questoes.map((q, i) => (
            <div key={q.id} className="flex items-center gap-3 px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg">
              <span className="text-xs text-ms-muted w-6 shrink-0">{i + 1}.</span>
              <p className="text-sm text-ms-main truncate flex-1">{q.statement}</p>
              <input
                type="number"
                step="0.1"
                min={0}
                className="w-20 px-2 py-1 bg-ms-card border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue"
                value={valoresPorQuestao[q.id] ?? 0}
                onChange={(e) => setValoresPorQuestao((prev) => ({ ...prev, [q.id]: Number(e.target.value) || 0 }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onVoltar} className="px-5 py-2.5 rounded-xl border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800">
          Voltar
        </button>
        <button
          disabled={!podeContinuar}
          onClick={handleContinuar}
          className="px-5 py-2.5 bg-ms-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
