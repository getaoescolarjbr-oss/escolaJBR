import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, FileSpreadsheet, Loader2, Printer, Table as TableIcon, Users, X } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import type { Avaliacao, QuestaoInfoRelatorio, RelatorioAvaliacaoCompleto, ResultadoAlunoDetalhado } from '../../../types/avaliacoes';
import { obterResultadosDetalhadosAvaliacao } from '../../../services/avaliacoesService';
import { printReport } from '../../../utils/printUtils';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

const SEM_TURMA = 'Sem turma';

interface EstatisticaQuestao {
  question_id: string;
  ordem: number;
  correct_letter: string;
  valor: number;
  totalRespostas: number;
  totalAcertos: number;
  totalErros: number;
  pctAcerto: number;
}

function calcularEstatisticasQuestoes(alunosGrupo: ResultadoAlunoDetalhado[], questoes: QuestaoInfoRelatorio[]): EstatisticaQuestao[] {
  const enviadas = alunosGrupo.filter((a) => a.finalizado_em);
  return questoes.map((q) => {
    const totalRespostas = enviadas.filter((al) => al.respostas[q.question_id]?.letra_marcada).length;
    const totalAcertos = enviadas.filter((al) => al.respostas[q.question_id]?.correta).length;
    return {
      question_id: q.question_id,
      ordem: q.ordem,
      correct_letter: q.correct_letter || '—',
      valor: q.valor,
      totalRespostas,
      totalAcertos,
      totalErros: totalRespostas - totalAcertos,
      pctAcerto: totalRespostas > 0 ? (totalAcertos / totalRespostas) * 100 : 0,
    };
  });
}

function corBarra(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function sanitizarNomeAba(nome: string, usados: Set<string>): string {
  let base = nome.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 28) || 'Turma';
  let candidato = base;
  let sufixo = 1;
  while (usados.has(candidato.toLowerCase())) {
    sufixo++;
    candidato = `${base} (${sufixo})`.slice(0, 31);
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

const ESTILO_HEADER = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '002677' } }, alignment: { horizontal: 'center', vertical: 'center' } };
const ESTILO_ACERTO = { font: { bold: true, color: { rgb: '006100' } }, fill: { fgColor: { rgb: 'C6EFCE' } }, alignment: { horizontal: 'center' } };
const ESTILO_ERRO = { font: { bold: true, color: { rgb: '9C0006' } }, fill: { fgColor: { rgb: 'FFC7CE' } }, alignment: { horizontal: 'center' } };

function criarPlanilhaAlunos(alunosGrupo: ResultadoAlunoDetalhado[], questoes: QuestaoInfoRelatorio[]) {
  const header = ['Aluno', 'Turma', 'SGDE', 'Status', 'Total Acertos', '% Acertos', 'Nota',
    ...questoes.map((q) => `Q${String(q.ordem).padStart(2, '0')} (Gab: ${q.correct_letter || '—'})`),
    'Data de Envio'];

  const linhas: (string | number)[][] = [header];
  const estilos: { r: number; c: number; s: Record<string, unknown> }[] = [];
  const primeiraColQuestao = 7;

  alunosGrupo.forEach((al, idx) => {
    const linha: (string | number)[] = [
      al.aluno_nome,
      al.turma_nome ?? '',
      al.codigo_sgde ?? '',
      al.finalizado_em ? 'Enviada' : 'Pendente',
      al.finalizado_em ? `${al.total_acertos} / ${al.total_questoes}` : '—',
      al.finalizado_em ? `${((al.total_acertos / (al.total_questoes || 1)) * 100).toFixed(1)}%` : '—',
      al.finalizado_em ? Number((al.nota ?? 0).toFixed(2)) : '',
    ];

    questoes.forEach((q, qi) => {
      const resp = al.finalizado_em ? al.respostas[q.question_id] : null;
      if (al.finalizado_em && resp?.letra_marcada) {
        linha.push(resp.letra_marcada);
        estilos.push({ r: idx + 1, c: primeiraColQuestao + qi, s: resp.correta ? ESTILO_ACERTO : ESTILO_ERRO });
      } else {
        linha.push(al.finalizado_em ? 'Em branco' : '—');
      }
    });

    linha.push(al.finalizado_em ? new Date(al.finalizado_em).toLocaleString('pt-BR') : '');
    linhas.push(linha);
  });

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (let c = 0; c < header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = ESTILO_HEADER;
  }
  estilos.forEach(({ r, c, s }) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = s;
  });
  ws['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, ...questoes.map(() => ({ wch: 14 })), { wch: 18 }];
  return ws;
}

function criarPlanilhaQuestoes(estat: EstatisticaQuestao[]) {
  const header = ['Questão', 'Gabarito', 'Valor', 'Alunos que Responderam', 'Total de Acertos', 'Total de Erros', 'Taxa de Acerto'];
  const linhas: (string | number)[][] = [header];
  const estilos: { r: number; c: number; s: Record<string, unknown> }[] = [];

  estat.forEach((q, idx) => {
    linhas.push([
      `Questão ${q.ordem}`,
      q.correct_letter,
      q.valor,
      q.totalRespostas,
      q.totalAcertos,
      q.totalErros,
      `${q.pctAcerto.toFixed(1)}%`,
    ]);
    estilos.push({
      r: idx + 1,
      c: 6,
      s: q.pctAcerto >= 70 ? ESTILO_ACERTO : q.pctAcerto >= 40
        ? { font: { bold: true, color: { rgb: '9C6500' } }, fill: { fgColor: { rgb: 'FFEB9C' } }, alignment: { horizontal: 'center' } }
        : ESTILO_ERRO,
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (let c = 0; c < header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = ESTILO_HEADER;
  }
  estilos.forEach(({ r, c, s }) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) ws[addr].s = s;
  });
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  return ws;
}

export function AvaliacaoResultadosModal({ avaliacao, onClose }: Props) {
  const [relatorio, setRelatorio] = useState<RelatorioAvaliacaoCompleto | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'turmas' | 'matriz'>('geral');
  const [erro, setErro] = useState<string | null>(null);
  const tabelaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    obterResultadosDetalhadosAvaliacao(avaliacao.id)
      .then(setRelatorio)
      .catch((e) => {
        const msg = e?.message || (e instanceof Error ? e.message : 'Não foi possível carregar os resultados.');
        setErro(msg);
      });
  }, [avaliacao.id]);

  const questoes = relatorio?.questoes ?? [];
  const alunos = relatorio?.alunos ?? [];
  const enviadas = useMemo(() => alunos.filter((r) => r.finalizado_em), [alunos]);

  // Agrupa os alunos por turma (mantém as turmas separadas no relatório em vez de
  // misturá-las quando o simulado/avaliação tem mais de uma turma vinculada).
  const turmasOrdenadas = useMemo(() => {
    const nomes = new Set(alunos.map((a) => a.turma_nome || SEM_TURMA));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [alunos]);

  const alunosPorTurma = useMemo(() => {
    const mapa = new Map<string, ResultadoAlunoDetalhado[]>();
    for (const turma of turmasOrdenadas) mapa.set(turma, []);
    for (const al of alunos) {
      const turma = al.turma_nome || SEM_TURMA;
      mapa.get(turma)?.push(al);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.aluno_nome.localeCompare(b.aluno_nome, 'pt-BR'));
    return mapa;
  }, [alunos, turmasOrdenadas]);

  const estatisticasPorTurma = useMemo(() => {
    const mapa = new Map<string, { mediaAcertos: number; mediaNota: number; enviadas: number; total: number; porQuestao: EstatisticaQuestao[] }>();
    for (const [turma, lista] of alunosPorTurma) {
      const env = lista.filter((a) => a.finalizado_em);
      const mediaAcertos = env.length > 0 ? env.reduce((s, a) => s + (a.total_acertos ?? 0), 0) / env.length : 0;
      const mediaNota = env.length > 0 ? env.reduce((s, a) => s + (a.nota ?? 0), 0) / env.length : 0;
      mapa.set(turma, { mediaAcertos, mediaNota, enviadas: env.length, total: lista.length, porQuestao: calcularEstatisticasQuestoes(lista, questoes) });
    }
    return mapa;
  }, [alunosPorTurma, questoes]);

  const estatisticasGeral = useMemo(() => calcularEstatisticasQuestoes(alunos, questoes), [alunos, questoes]);

  const estatisticas = useMemo(() => {
    if (enviadas.length === 0) return null;
    const mediaNota = enviadas.reduce((soma, r) => soma + (r.nota ?? 0), 0) / enviadas.length;
    const mediaAcertos = enviadas.reduce((soma, r) => soma + (r.total_acertos ?? 0), 0) / enviadas.length;
    const taxaAcertoGeral = questoes.length > 0 ? (mediaAcertos / questoes.length) * 100 : 0;
    return {
      mediaNota,
      mediaAcertos,
      taxaAcertoGeral,
    };
  }, [enviadas, questoes.length]);

  function imprimir() {
    printReport(tabelaRef.current, {
      title: `Resultados — ${avaliacao.titulo}`,
      subtitle: avaliacao.tipo === 'SIMULADO' ? 'Simulado (não gera nota de boletim)' : avaliacao.disciplina ?? undefined,
      info: [
        { label: 'Total de Alunos', value: `${alunos.length}` },
        { label: 'Turmas', value: `${turmasOrdenadas.length}` },
        { label: 'Enviaram', value: `${enviadas.length} (${alunos.length > 0 ? ((enviadas.length / alunos.length) * 100).toFixed(0) : 0}%)` },
        ...(estatisticas ? [
          { label: 'Média de Acertos', value: `${estatisticas.mediaAcertos.toFixed(1)} / ${questoes.length}` },
          { label: 'Média da Nota', value: estatisticas.mediaNota.toFixed(2) },
        ] : []),
      ],
    });
  }

  function exportarXlsx() {
    if (!relatorio || alunos.length === 0) return;

    const livro = XLSX.utils.book_new();
    const abasUsadas = new Set<string>();

    // Uma planilha de respostas + uma de estatísticas por questão para CADA turma,
    // para que turmas diferentes não fiquem misturadas na mesma tabela.
    for (const turma of turmasOrdenadas) {
      const alunosTurma = alunosPorTurma.get(turma) ?? [];
      const estatTurma = estatisticasPorTurma.get(turma)?.porQuestao ?? [];

      const nomeAbaAlunos = sanitizarNomeAba(`Resp. ${turma}`, abasUsadas);
      XLSX.utils.book_append_sheet(livro, criarPlanilhaAlunos(alunosTurma, questoes), nomeAbaAlunos);

      const nomeAbaQuestoes = sanitizarNomeAba(`Acertos ${turma}`, abasUsadas);
      XLSX.utils.book_append_sheet(livro, criarPlanilhaQuestoes(estatTurma), nomeAbaQuestoes);
    }

    // Relatório geral com o total de acertos de cada questão somando todas as turmas.
    const nomeAbaGeral = sanitizarNomeAba('Acertos Geral', abasUsadas);
    XLSX.utils.book_append_sheet(livro, criarPlanilhaQuestoes(estatisticasGeral), nomeAbaGeral);

    const safeTitle = avaliacao.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    XLSX.writeFile(livro, `relatorio-acertos-${safeTitle}.xlsx`);
  }

  function GraficoQuestoes({ dados }: { dados: EstatisticaQuestao[] }) {
    return (
      <div className="space-y-1.5">
        {dados.map((q) => (
          <div key={q.question_id} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-ms-muted font-bold">Q{q.ordem} ({q.correct_letter})</span>
            <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
              <div
                className={`h-full ${corBarra(q.pctAcerto)} transition-all`}
                style={{ width: `${Math.max(q.pctAcerto, q.totalRespostas > 0 ? 3 : 0)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-ms-main font-bold text-right">
              {q.totalAcertos}/{q.totalRespostas} ({q.pctAcerto.toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    );
  }

  function TabelaQuestoes({ dados }: { dados: EstatisticaQuestao[] }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-ms-muted">
              <th className="py-2 px-3">Questão</th>
              <th className="py-2 px-2 text-center">Gabarito</th>
              <th className="py-2 px-2 text-center">Responderam</th>
              <th className="py-2 px-2 text-center">Acertos</th>
              <th className="py-2 px-2 text-center">Erros</th>
              <th className="py-2 px-2 text-center">% Acerto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {dados.map((q) => (
              <tr key={q.question_id}>
                <td className="py-2 px-3 font-bold text-ms-main">Questão {q.ordem}</td>
                <td className="py-2 px-2 text-center text-emerald-400 font-bold">{q.correct_letter}</td>
                <td className="py-2 px-2 text-center text-ms-muted">{q.totalRespostas}</td>
                <td className="py-2 px-2 text-center text-emerald-400 font-bold">{q.totalAcertos}</td>
                <td className="py-2 px-2 text-center text-red-400 font-bold">{q.totalErros}</td>
                <td className="py-2 px-2 text-center font-bold text-ms-main">{q.pctAcerto.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 no-print">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Resultados — {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted">
              {avaliacao.tipo === 'SIMULADO' ? 'Simulado Público' : avaliacao.disciplina ?? 'Avaliação'} · {questoes.length} questão(ões)
              {turmasOrdenadas.length > 0 ? ` · ${turmasOrdenadas.length} turma(s)` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {relatorio && alunos.length > 0 && (
              <>
                <button
                  onClick={imprimir}
                  title="Exportar PDF (imprimir)"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-700 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800 hover:border-gray-600"
                >
                  <Printer className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={exportarXlsx}
                  title="Exportar Relatório Completo em XLSX (Excel) — com abas separadas por turma"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar XLSX (Excel)
                </button>
              </>
            )}
            <button onClick={onClose} className="text-ms-muted hover:text-ms-main ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {!relatorio && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 my-12" />}

          {relatorio && (
            <div ref={tabelaRef} className="space-y-4">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Total de Alunos</p>
                  <p className="text-xl font-bold text-ms-main mt-0.5">{alunos.length}</p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Turmas</p>
                  <p className="text-xl font-bold text-ms-main mt-0.5">{turmasOrdenadas.length}</p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Enviados</p>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">
                    {enviadas.length} <span className="text-xs text-ms-muted font-normal">({alunos.length > 0 ? ((enviadas.length / alunos.length) * 100).toFixed(0) : 0}%)</span>
                  </p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Média de Acertos</p>
                  <p className="text-xl font-bold text-blue-400 mt-0.5">
                    {estatisticas ? estatisticas.mediaAcertos.toFixed(1) : '—'} <span className="text-xs text-ms-muted font-normal">/ {questoes.length}</span>
                  </p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Média Geral</p>
                  <p className="text-xl font-bold text-ms-main mt-0.5">
                    {estatisticas ? estatisticas.mediaNota.toFixed(2) : '—'}
                  </p>
                </div>
              </div>

              {/* Seletor de Abas */}
              <div className="flex items-center gap-2 border-b border-gray-800 no-print pt-2">
                <button
                  onClick={() => setAbaAtiva('geral')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    abaAtiva === 'geral' ? 'border-blue-400 text-blue-400' : 'border-transparent text-ms-muted hover:text-ms-main'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Visão Geral por Turma
                </button>
                <button
                  onClick={() => setAbaAtiva('turmas')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    abaAtiva === 'turmas' ? 'border-blue-400 text-blue-400' : 'border-transparent text-ms-muted hover:text-ms-main'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Acertos por Questão
                </button>
                <button
                  onClick={() => setAbaAtiva('matriz')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    abaAtiva === 'matriz' ? 'border-blue-400 text-blue-400' : 'border-transparent text-ms-muted hover:text-ms-main'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" /> Matriz de Respostas
                </button>
              </div>

              {alunos.length === 0 ? (
                <p className="text-center text-ms-muted py-8">Nenhum aluno vinculado a esta avaliação.</p>
              ) : abaAtiva === 'geral' ? (
                /* Tabela Geral, agrupada por turma */
                <div className="space-y-6">
                  {turmasOrdenadas.map((turma) => {
                    const alunosTurma = alunosPorTurma.get(turma) ?? [];
                    const est = estatisticasPorTurma.get(turma);
                    return (
                      <div key={turma}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-ms-main flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-blue-400" /> {turma}
                            <span className="text-xs font-normal text-ms-muted">({alunosTurma.length} aluno(s))</span>
                          </h3>
                          {est && (
                            <span className="text-xs text-ms-muted">
                              Média: <span className="font-bold text-ms-main">{est.mediaAcertos.toFixed(1)}/{questoes.length}</span> acertos · Nota média: <span className="font-bold text-ms-main">{est.mediaNota.toFixed(2)}</span>
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto border border-gray-800 rounded-xl">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-gray-800 text-xs text-ms-muted">
                                <th className="py-2.5 px-3">Aluno</th>
                                <th className="py-2.5 px-3 text-center">SGDE</th>
                                <th className="py-2.5 px-3 text-center">Acertos</th>
                                <th className="py-2.5 px-3 text-center">Nota</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                              {alunosTurma.map((al) => (
                                <tr key={al.aluno_id} className="hover:bg-ms-dark/50">
                                  <td className="py-2.5 px-3 font-bold text-ms-main">{al.aluno_nome}</td>
                                  <td className="py-2.5 px-3 text-center text-xs text-ms-muted">{al.codigo_sgde ?? '—'}</td>
                                  <td className="py-2.5 px-3 text-center font-bold">
                                    {al.finalizado_em ? (
                                      <span className="text-blue-400">{al.total_acertos} / {al.total_questoes}</span>
                                    ) : (
                                      <span className="text-ms-muted">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold text-ms-main">
                                    {al.finalizado_em ? (al.nota ?? 0).toFixed(2) : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {al.finalizado_em ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400">
                                        Enviada
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-normal text-ms-muted bg-gray-800">
                                        Pendente
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : abaAtiva === 'turmas' ? (
                /* Relatório de acertos por questão — por turma + geral, com gráfico */
                <div className="space-y-8">
                  {turmasOrdenadas.map((turma) => {
                    const est = estatisticasPorTurma.get(turma);
                    if (!est) return null;
                    return (
                      <div key={turma}>
                        <h3 className="text-sm font-bold text-ms-main flex items-center gap-2 mb-2">
                          <Users className="w-3.5 h-3.5 text-blue-400" /> {turma}
                          <span className="text-xs font-normal text-ms-muted">
                            ({est.enviadas}/{est.total} enviaram · média {est.mediaAcertos.toFixed(1)}/{questoes.length})
                          </span>
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <TabelaQuestoes dados={est.porQuestao} />
                          <GraficoQuestoes dados={est.porQuestao} />
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-4 border-t border-gray-800">
                    <h3 className="text-sm font-bold text-ms-main flex items-center gap-2 mb-2">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> Geral — Todas as Turmas
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <TabelaQuestoes dados={estatisticasGeral} />
                      <GraficoQuestoes dados={estatisticasGeral} />
                    </div>
                  </div>
                </div>
              ) : (
                /* Matriz de Respostas Questão a Questão, agrupada por turma */
                <div className="space-y-6">
                  {turmasOrdenadas.map((turma) => {
                    const alunosTurma = alunosPorTurma.get(turma) ?? [];
                    return (
                      <div key={turma}>
                        <h3 className="text-sm font-bold text-ms-main flex items-center gap-2 mb-2">
                          <Users className="w-3.5 h-3.5 text-blue-400" /> {turma}
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-gray-800 text-ms-muted">
                                <th className="py-2.5 px-3 sticky left-0 bg-ms-card z-10 font-bold min-w-[180px]">Aluno</th>
                                <th className="py-2.5 px-2 text-center">Acertos</th>
                                {questoes.map((q) => (
                                  <th key={q.question_id} className="py-2.5 px-2 text-center min-w-[48px]" title={`Gabarito: ${q.correct_letter || '—'}`}>
                                    Q{q.ordem}
                                    <span className="block text-[10px] text-emerald-400 font-bold">({q.correct_letter || '—'})</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                              {alunosTurma.map((al) => (
                                <tr key={al.aluno_id} className="hover:bg-ms-dark/50">
                                  <td className="py-2 px-3 font-bold text-ms-main sticky left-0 bg-ms-card truncate max-w-[200px]">
                                    {al.aluno_nome}
                                  </td>
                                  <td className="py-2 px-2 text-center font-bold text-blue-400">
                                    {al.finalizado_em ? `${al.total_acertos}/${al.total_questoes}` : '—'}
                                  </td>
                                  {questoes.map((q) => {
                                    if (!al.finalizado_em) {
                                      return <td key={q.question_id} className="py-2 px-2 text-center text-gray-600">—</td>;
                                    }
                                    const resp = al.respostas[q.question_id];
                                    const letra = resp?.letra_marcada;
                                    const correta = resp?.correta;

                                    if (!letra) {
                                      return <td key={q.question_id} className="py-2 px-2 text-center text-ms-muted font-mono text-[11px]">-</td>;
                                    }

                                    return (
                                      <td key={q.question_id} className="py-2 px-2 text-center">
                                        <span
                                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-xs ${
                                            correta
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                              : 'bg-red-500/20 text-red-300 border border-red-500/40'
                                          }`}
                                          title={`Marcou: ${letra} · Gabarito: ${q.correct_letter || '—'}`}
                                        >
                                          {letra}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
