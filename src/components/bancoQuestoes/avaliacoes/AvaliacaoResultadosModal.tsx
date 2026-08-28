import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Printer, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Avaliacao, ResultadoAluno } from '../../../types/avaliacoes';
import { listarResultadosAvaliacao } from '../../../services/avaliacoesService';
import { printReport } from '../../../utils/printUtils';

interface Props {
  avaliacao: Avaliacao;
  onClose: () => void;
}

export function AvaliacaoResultadosModal({ avaliacao, onClose }: Props) {
  const [resultados, setResultados] = useState<ResultadoAluno[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const tabelaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listarResultadosAvaliacao(avaliacao.id)
      .then(setResultados)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar os resultados.'));
  }, [avaliacao.id]);

  const enviadas = resultados?.filter((r) => r.finalizado_em) ?? [];
  const media = enviadas.length > 0 ? enviadas.reduce((soma, r) => soma + (r.nota ?? 0), 0) / enviadas.length : null;

  function imprimir() {
    printReport(tabelaRef.current, {
      title: `Resultados — ${avaliacao.titulo}`,
      subtitle: avaliacao.tipo === 'SIMULADO' ? 'Simulado (não gera nota de boletim)' : avaliacao.disciplina ?? undefined,
      info: [
        { label: 'Enviaram', value: `${enviadas.length} de ${resultados?.length ?? 0}` },
        ...(media !== null ? [{ label: 'Média', value: media.toFixed(2) }] : []),
      ],
    });
  }

  function exportarXlsx() {
    if (!resultados) return;
    const linhas = resultados.map((r) => ({
      Aluno: r.aluno_nome,
      Turma: r.turma_nome ?? '',
      Status: r.finalizado_em ? 'Enviada' : 'Pendente',
      Nota: r.finalizado_em ? Number((r.nota ?? 0).toFixed(2)) : '',
      'Enviado em': r.finalizado_em ? new Date(r.finalizado_em).toLocaleString('pt-BR') : '',
    }));
    const planilha = XLSX.utils.json_to_sheet(linhas);
    planilha['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 18 }];
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, 'Resultados');
    XLSX.writeFile(livro, `resultados-${avaliacao.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 no-print">
          <h2 className="text-lg font-bold text-ms-main">Resultados — {avaliacao.titulo}</h2>
          <div className="flex items-center gap-2">
            {resultados && resultados.length > 0 && (
              <>
                <button onClick={imprimir} title="Exportar PDF (imprimir)" className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800">
                  <Printer className="w-3.5 h-3.5" /> PDF
                </button>
                <button onClick={exportarXlsx} title="Exportar XLSX" className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 text-ms-main rounded-lg text-xs font-bold hover:bg-gray-800">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> XLSX
                </button>
              </>
            )}
            <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}
          {!resultados && !erro && <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" />}

          {resultados && (
            <div ref={tabelaRef}>
              <div className="flex items-center justify-between text-sm text-ms-muted">
                <span>{enviadas.length} de {resultados.length} aluno(s) enviaram</span>
                {media !== null && <span className="font-bold text-ms-main">Média: {media.toFixed(2)}</span>}
              </div>

              {resultados.length === 0 ? (
                <p className="text-center text-ms-muted py-8">Nenhum aluno vinculado às turmas desta avaliação.</p>
              ) : (
                <table className="w-full mt-3">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-bold text-ms-muted pb-2">Aluno</th>
                      <th className="text-xs font-bold text-ms-muted pb-2">Turma</th>
                      <th className="text-xs font-bold text-ms-muted pb-2">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((r) => (
                      <tr key={r.aluno_id} className="border-t border-gray-800">
                        <td className="py-2 text-sm font-bold text-ms-main">{r.aluno_nome}</td>
                        <td className="py-2 text-sm text-ms-muted text-center">{r.turma_nome ?? '—'}</td>
                        <td className="py-2 text-sm font-bold text-ms-main text-center">
                          {r.finalizado_em ? (r.nota ?? 0).toFixed(2) : <span className="text-xs font-normal text-ms-muted">Pendente</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
