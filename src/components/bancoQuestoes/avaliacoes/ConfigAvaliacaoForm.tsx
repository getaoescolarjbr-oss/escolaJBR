import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import type { Question } from '../../../types/bancoQuestoes';
import type { ModoAvaliacao, NovaAvaliacaoInput, TipoAvaliacao } from '../../../types/avaliacoes';
import { listarTurmas } from '../../../services/agendamentoService';
import { listarDisciplinasCatalogo } from '../../../services/avaliacoesService';
import { getBimestreFromDate } from '../../../utils/academicUtils';

const BIMESTRES = [1, 2, 3, 4] as const;

const inputClass =
  'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blueText';

export interface ConfigAvaliacaoInicial {
  titulo: string;
  disciplinaId: string | null;
  bimestreId: number | null;
  instrucoes: string;
  valorTotal: number;
  valoresPorQuestao: Record<string, number>;
  tipo: TipoAvaliacao;
  modo: ModoAvaliacao;
  dataAplicacao: string | null;
  prazoEntrega: string | null;
  turmaIds: string[];
}

interface Props {
  questoes: Question[];
  inicial?: ConfigAvaliacaoInicial;
  salvando?: boolean;
  textoBotaoContinuar?: string;
  onVoltar: () => void;
  onContinuar: (
    config: Omit<NovaAvaliacaoInput, 'questoes'>,
    valoresPorQuestao: Record<string, number>,
    turmaNomes: string[],
    questoesOrdenadas: Question[]
  ) => void;
}

// Passo 2 do gerador (também reaproveitado para editar uma avaliação já salva — ver
// EditarAvaliacaoModal.tsx): configura a avaliação (valor total dividido automaticamente
// entre as questões selecionadas, mas editável por questão), turma(s) alvo e modo de
// aplicação. Quando `inicial` é passado, os campos partem preenchidos com os dados já
// salvos em vez dos valores padrão de uma avaliação nova.
export function ConfigAvaliacaoForm({ questoes, inicial, salvando, textoBotaoContinuar, onVoltar, onContinuar }: Props) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? 'Avaliação');
  const [disciplinas, setDisciplinas] = useState<{ id: string; nome: string }[]>([]);
  const [disciplinaId, setDisciplinaId] = useState<string>(inicial?.disciplinaId ?? '');
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(true);
  const [instrucoes, setInstrucoes] = useState(inicial?.instrucoes ?? 'Leia atentamente cada questão antes de responder. Use caneta azul ou preta.');
  const [valorTotal, setValorTotal] = useState(inicial?.valorTotal ?? 10);
  const [valoresPorQuestao, setValoresPorQuestao] = useState<Record<string, number>>(inicial?.valoresPorQuestao ?? {});
  const [tipo, setTipo] = useState<TipoAvaliacao>(inicial?.tipo ?? 'AVALIACAO');
  const [modo, setModo] = useState<ModoAvaliacao>(inicial?.modo ?? 'IMPRESSA');
  const [dataAplicacao, setDataAplicacao] = useState(() => inicial?.dataAplicacao?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [bimestreId, setBimestreId] = useState<number>(() => inicial?.bimestreId ?? getBimestreFromDate(new Date().toISOString().slice(0, 10)) ?? 1);
  const [prazoEntrega, setPrazoEntrega] = useState(() => (inicial?.prazoEntrega ? new Date(inicial.prazoEntrega).toISOString().slice(0, 16) : ''));
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [turmaIds, setTurmaIds] = useState<Set<string>>(new Set(inicial?.turmaIds ?? []));
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [ordem, setOrdem] = useState<Question[]>(questoes);
  const primeiraDistribuicao = useRef(true);

  function moverQuestao(index: number, direcao: -1 | 1) {
    setOrdem((prev) => {
      const alvo = index + direcao;
      if (alvo < 0 || alvo >= prev.length) return prev;
      const proxima = [...prev];
      [proxima[index], proxima[alvo]] = [proxima[alvo], proxima[index]];
      return proxima;
    });
  }

  useEffect(() => {
    listarTurmas().then(setTurmas).catch(() => setTurmas([])).finally(() => setLoadingTurmas(false));
  }, []);

  useEffect(() => {
    listarDisciplinasCatalogo()
      .then((lista) => {
        setDisciplinas(lista);
        if (inicial) return; // já veio com a disciplina certa — não sobrescrever com sugestão.
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
    if (inicial) return; // data/bimestre já vieram preenchidos ao editar.
    const sugerido = getBimestreFromDate(dataAplicacao);
    if (sugerido) setBimestreId(sugerido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataAplicacao]);

  // Redistribui igualmente sempre que o valor total ou a lista de questões muda — o
  // professor pode sobrescrever valores individuais depois, mas eles são recalculados se o
  // valor total for alterado de novo (evita inconsistência de soma). Ao editar uma avaliação
  // existente, pula a primeira execução pra não substituir os valores já salvos por questão.
  useEffect(() => {
    if (primeiraDistribuicao.current) {
      primeiraDistribuicao.current = false;
      if (inicial) return;
    }
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

  const ehSimulado = tipo === 'SIMULADO';
  // Simulado é sempre respondido pelo link público (sem login) — não faz sentido no
  // modo "impressa" nem exige disciplina/bimestre, já que nunca gera nota em "Notas e
  // Avaliações" (ver create_simulados_publico.sql).
  const modoEfetivo: ModoAvaliacao = ehSimulado ? 'ONLINE' : modo;
  const precisaOnline = modoEfetivo === 'ONLINE' || modoEfetivo === 'AMBAS';
  const podeContinuar =
    titulo.trim().length > 0 &&
    (ehSimulado || !!disciplinaId) &&
    turmaIds.size > 0 &&
    (!precisaOnline || prazoEntrega);

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
        modo: modoEfetivo,
        tipo,
        dataAplicacao: dataAplicacao || null,
        prazoEntrega: precisaOnline && prazoEntrega ? new Date(prazoEntrega).toISOString() : null,
        turmaIds: Array.from(turmaIds),
      },
      valoresPorQuestao,
      turmaNomes,
      ordem
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-ms-muted">Tipo</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => setTipo('AVALIACAO')}
              className={`text-left px-4 py-2.5 rounded-lg border text-sm ${tipo === 'AVALIACAO' ? 'border-ms-blueText bg-ms-blue/10' : 'border-gray-800'}`}
            >
              <p className="font-bold text-ms-main">Avaliação</p>
              <p className="text-xs text-ms-muted">Gera nota em "Notas e Avaliações" ao publicar.</p>
            </button>
            <button
              type="button"
              onClick={() => setTipo('SIMULADO')}
              className={`text-left px-4 py-2.5 rounded-lg border text-sm ${tipo === 'SIMULADO' ? 'border-ms-blueText bg-ms-blue/10' : 'border-gray-800'}`}
            >
              <p className="font-bold text-ms-main">Simulado</p>
              <p className="text-xs text-ms-muted">Link público sem login (aluno digita o código SGDE) — não gera nota de boletim.</p>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-ms-muted">Título *</label>
            <input className={inputClass} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Avaliação / Prova / Simulado" />
          </div>
          <div>
            <label className="text-xs font-bold text-ms-muted">Disciplina {ehSimulado ? '' : '*'}</label>
            <select className={inputClass} value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} disabled={loadingDisciplinas}>
              <option value="">{loadingDisciplinas ? 'Carregando...' : 'Selecione...'}</option>
              {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          {!ehSimulado && (
            <div>
              <label className="text-xs font-bold text-ms-muted">Bimestre *</label>
              <select className={inputClass} value={bimestreId} onChange={(e) => setBimestreId(Number(e.target.value))}>
                {BIMESTRES.map((b) => <option key={b} value={b}>{b}º Bimestre</option>)}
              </select>
            </div>
          )}
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
          {!ehSimulado && (
            <div>
              <label className="text-xs font-bold text-ms-muted">Modo de aplicação</label>
              <select className={inputClass} value={modo} onChange={(e) => setModo(e.target.value as ModoAvaliacao)}>
                <option value="IMPRESSA">Só impressa</option>
                <option value="ONLINE">Só online</option>
                <option value="AMBAS">Impressa e online</option>
              </select>
            </div>
          )}
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
          <Loader2 className="w-5 h-5 animate-spin text-ms-blueText" />
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
          <p className="text-sm font-bold text-ms-main">Ordem e valor das questões</p>
          <p className={`text-xs font-bold ${Math.abs(somaValores - valorTotal) > 0.01 ? 'text-amber-400' : 'text-ms-muted'}`}>
            Soma: {somaValores.toFixed(2)} / {valorTotal.toFixed(2)}
          </p>
        </div>
        <p className="text-xs text-ms-muted">Use as setas para colocar as questões na ordem em que devem aparecer na prova.</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {ordem.map((q, i) => (
            <div key={q.id} className="flex items-center gap-3 px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg">
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moverQuestao(i, -1)}
                  className="text-ms-muted hover:text-ms-main disabled:opacity-25"
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === ordem.length - 1}
                  onClick={() => moverQuestao(i, 1)}
                  className="text-ms-muted hover:text-ms-main disabled:opacity-25"
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs text-ms-muted w-6 shrink-0">{i + 1}.</span>
              <p className="text-sm text-ms-main truncate flex-1">{q.statement}</p>
              <input
                type="number"
                step="0.1"
                min={0}
                className="w-20 px-2 py-1 bg-ms-card border border-gray-800 rounded-lg text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blueText"
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
          disabled={!podeContinuar || !!salvando}
          onClick={handleContinuar}
          className="flex items-center gap-2 px-5 py-2.5 bg-ms-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          {textoBotaoContinuar ?? 'Continuar'}
        </button>
      </div>
    </div>
  );
}
