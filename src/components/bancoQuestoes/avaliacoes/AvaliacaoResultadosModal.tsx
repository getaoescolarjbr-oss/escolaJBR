import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, FileSpreadsheet, Loader2, Printer, Table as TableIcon, X, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Avaliacao, RelatorioAvaliacaoCompleto } from '../../../types/avaliacoes';
import { obterResultadosDetalhadosAvaliacao } from '../../../services/avaliacoesService';
import { printReport } from '../../../utils/printUtils';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

export function AvaliacaoResultadosModal({ avaliacao, onClose }: Props) {
  const [relatorio, setRelatorio] = useState<RelatorioAvaliacaoCompleto | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'matriz'>('geral');
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

    // 1. Aba Principal: Respostas e Acertos por Aluno
    const linhasAlunos = alunos.map((al) => {
      const linha: Record<string, string | number> = {
        Aluno: al.aluno_nome,
        Turma: al.turma_nome ?? '',
        SGDE: al.codigo_sgde ?? '',
        Status: al.finalizado_em ? 'Enviada' : 'Pendente',
        'Total Acertos': al.finalizado_em ? `${al.total_acertos} / ${al.total_questoes}` : '—',
        '% Acertos': al.finalizado_em ? `${((al.total_acertos / (al.total_questoes || 1)) * 100).toFixed(1)}%` : '—',
        'Nota': al.finalizado_em ? Number((al.nota ?? 0).toFixed(2)) : '',
      };

      // Adiciona cada questão com a alternativa marcada
      questoes.forEach((q) => {
        const header = `Q${String(q.ordem).padStart(2, '0')} (Gab: ${q.correct_letter || '—'})`;
        if (al.finalizado_em) {
          const resp = al.respostas[q.question_id];
          if (resp?.letra_marcada) {
            linha[header] = `${resp.letra_marcada} ${resp.correta ? '✓' : '✗'}`;
          } else {
            linha[header] = 'Em branco';
          }
        } else {
          linha[header] = '—';
        }
      });

      linha['Data de Envio'] = al.finalizado_em ? new Date(al.finalizado_em).toLocaleString('pt-BR') : '';
      return linha;
    });

    // 2. Aba Secundária: Estatísticas por Questão
    const linhasQuestoes = questoes.map((q) => {
      const totalRespostas = enviadas.filter((al) => al.respostas[q.question_id]?.letra_marcada).length;
      const totalAcertos = enviadas.filter((al) => al.respostas[q.question_id]?.correta).length;
      const pctAcerto = totalRespostas > 0 ? `${((totalAcertos / totalRespostas) * 100).toFixed(1)}%` : '0.0%';

      return {
        Questão: `Questão ${q.ordem}`,
        Gabarito: q.correct_letter || '—',
        Valor: q.valor,
        'Alunos que Responderam': totalRespostas,
        'Total de Acertos': totalAcertos,
        'Total de Erros': totalRespostas - totalAcertos,
        'Taxa de Acerto': pctAcerto,
      };
    });

    const livro = XLSX.utils.book_new();

    // Cria planilha de alunos
    const planilhaAlunos = XLSX.utils.json_to_sheet(linhasAlunos);
    const colWidthsAlunos = [
      { wch: 32 }, // Aluno
      { wch: 12 }, // Turma
      { wch: 14 }, // SGDE
      { wch: 10 }, // Status
      { wch: 14 }, // Total Acertos
      { wch: 10 }, // % Acertos
      { wch: 8 },  // Nota
      ...questoes.map(() => ({ wch: 14 })), // Questões
      { wch: 18 }, // Data Envio
    ];
    planilhaAlunos['!cols'] = colWidthsAlunos;
    XLSX.utils.book_append_sheet(livro, planilhaAlunos, 'Respostas por Aluno');

    // Cria planilha de questões
    const planilhaQuestoes = XLSX.utils.json_to_sheet(linhasQuestoes);
    planilhaQuestoes['!cols'] = [
      { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(livro, planilhaQuestoes, 'Estatísticas por Questão');

    const safeTitle = avaliacao.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    XLSX.writeFile(livro, `relatorio-acertos-${safeTitle}.xlsx`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 no-print">
          <div>
            <h2 className="text-lg font-bold text-ms-main">Resultados — {avaliacao.titulo}</h2>
            <p className="text-xs text-ms-muted">
              {avaliacao.tipo === 'SIMULADO' ? 'Simulado Público' : avaliacao.disciplina ?? 'Avaliação'} · {questoes.length} questão(ões)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {relatorio && alunos.length > 0 && (
              <>
                <button
                  onClick={imprimir}
                  title="Exportar PDF (imprimir)"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800"
                >
                  <Printer className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={exportarXlsx}
                  title="Exportar Relatório Completo em XLSX (Excel)"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/30 text-emerald-300 border border-emerald-600/40 rounded-lg text-xs font-bold hover:bg-emerald-700/50"
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
          {!relatorio && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue my-12" />}

          {relatorio && (
            <div ref={tabelaRef} className="space-y-4">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Total de Alunos</p>
                  <p className="text-xl font-bold text-ms-main mt-0.5">{alunos.length}</p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Enviados</p>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">
                    {enviadas.length} <span className="text-xs text-ms-muted font-normal">({alunos.length > 0 ? ((enviadas.length / alunos.length) * 100).toFixed(0) : 0}%)</span>
                  </p>
                </div>
                <div className="bg-ms-dark border border-gray-800 rounded-xl p-3">
                  <p className="text-xs text-ms-muted font-bold">Média de Acertos</p>
                  <p className="text-xl font-bold text-ms-blue mt-0.5">
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
                  className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                    abaAtiva === 'geral' ? 'border-ms-blue text-ms-blue' : 'border-transparent text-ms-muted hover:text-ms-main'
                  }`}
                >
                  Visão Geral
                </button>
                <button
                  onClick={() => setAbaAtiva('matriz')}
                  className={`px-4 py-2 text-sm font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                    abaAtiva === 'matriz' ? 'border-ms-blue text-ms-blue' : 'border-transparent text-ms-muted hover:text-ms-main'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" /> Matriz de Respostas (Questão a Questão)
                </button>
              </div>

              {alunos.length === 0 ? (
                <p className="text-center text-ms-muted py-8">Nenhum aluno vinculado a esta avaliação.</p>
              ) : abaAtiva === 'geral' ? (
                /* Tabela Geral */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-xs text-ms-muted">
                        <th className="py-2.5 px-3">Aluno</th>
                        <th className="py-2.5 px-3 text-center">Turma</th>
                        <th className="py-2.5 px-3 text-center">SGDE</th>
                        <th className="py-2.5 px-3 text-center">Acertos</th>
                        <th className="py-2.5 px-3 text-center">Nota</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {alunos.map((al) => (
                        <tr key={al.aluno_id} className="hover:bg-ms-dark/50">
                          <td className="py-2.5 px-3 font-bold text-ms-main">{al.aluno_nome}</td>
                          <td className="py-2.5 px-3 text-center text-ms-muted">{al.turma_nome ?? '—'}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-ms-muted">{al.codigo_sgde ?? '—'}</td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            {al.finalizado_em ? (
                              <span className="text-ms-blue">{al.total_acertos} / {al.total_questoes}</span>
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
              ) : (
                /* Matriz de Respostas Questão a Questão */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-ms-muted">
                        <th className="py-2.5 px-3 sticky left-0 bg-ms-card z-10 font-bold min-w-[180px]">Aluno</th>
                        <th className="py-2.5 px-2 text-center">Turma</th>
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
                      {alunos.map((al) => (
                        <tr key={al.aluno_id} className="hover:bg-ms-dark/50">
                          <td className="py-2 px-3 font-bold text-ms-main sticky left-0 bg-ms-card truncate max-w-[200px]">
                            {al.aluno_nome}
                          </td>
                          <td className="py-2 px-2 text-center text-ms-muted">{al.turma_nome ?? '—'}</td>
                          <td className="py-2 px-2 text-center font-bold text-ms-blue">
                            {al.finalizado_em ? `${al.total_acertos}/${al.total_questoes}` : '—'}
                          </td>
                          {questoes.map((q) => {
                            if (!al.finalizado_em) {
                              return <td key={q.question_id} className="py-2 px-2 text-center text-gray-700">—</td>;
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
