import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { obterRelatorioRedacoes, type LinhaRelatorioRedacao } from '../../../services/redacaoService';
import { FAIXAS, compararComIa, relatorioParaCsv, resumoPorCriterio, resumoPorTurma } from '../../../lib/relatorioRedacao';

// Relatório das redações já corrigidas de uma prova: desempenho por turma, critérios em que a turma mais
// perdeu pontos e o quanto a prévia da IA se aproximou da nota do professor.

interface Props {
  provaId: string;
  titulo: string;
  onVoltar: () => void;
}

const f1 = (n: number) => n.toFixed(1).replace('.', ',');

function Barra({ valor, cor = 'bg-ms-blue' }: { valor: number; cor?: string }) {
  return (
    <div className="h-2 w-full rounded bg-ms-dark overflow-hidden">
      <div className={`h-full ${cor}`} style={{ width: `${Math.max(0, Math.min(100, valor))}%` }} />
    </div>
  );
}

export function RelatorioRedacoes({ provaId, titulo, onVoltar }: Props) {
  const [linhas, setLinhas] = useState<LinhaRelatorioRedacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [questao, setQuestao] = useState('');

  useEffect(() => {
    obterRelatorioRedacoes(provaId).then(setLinhas).catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar o relatório.'));
  }, [provaId]);

  const questoes = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const l of linhas ?? []) m.set(l.question_id, l.tema);
    return [...m.entries()].map(([id, tema]) => ({ id, tema }));
  }, [linhas]);

  const visiveis = useMemo(() => (linhas ?? []).filter((l) => !questao || l.question_id === questao), [linhas, questao]);
  const turmas = useMemo(() => resumoPorTurma(visiveis), [visiveis]);
  const criterios = useMemo(() => resumoPorCriterio(visiveis), [visiveis]);
  const ia = useMemo(() => compararComIa(visiveis), [visiveis]);

  function baixarCsv() {
    const url = URL.createObjectURL(new Blob([relatorioParaCsv(visiveis)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `redacoes-${titulo.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onVoltar} className="flex items-center gap-1 text-sm text-ms-blue hover:underline"><ArrowLeft className="w-4 h-4" /> Voltar à lista</button>
        {questoes.length > 1 && (
          <select value={questao} onChange={(e) => setQuestao(e.target.value)} aria-label="Questão de redação"
            className="px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-sm">
            <option value="">Todas as redações</option>
            {questoes.map((q, i) => <option key={q.id} value={q.id}>Redação {i + 1}{q.tema ? ` — ${q.tema.slice(0, 50)}` : ''}</option>)}
          </select>
        )}
        {visiveis.length > 0 && (
          <button onClick={baixarCsv} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-800 text-xs font-bold text-ms-main hover:bg-gray-800">
            <Download className="w-3.5 h-3.5" /> Baixar planilha (CSV)
          </button>
        )}
      </div>

      {erro && <p className="text-sm text-red-400">{erro}</p>}
      {!linhas && !erro && <div className="flex items-center gap-2 text-ms-muted py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>}
      {linhas && visiveis.length === 0 && (
        <p className="text-sm text-ms-muted text-center py-8">Ainda não há redação com nota confirmada nesta prova.</p>
      )}

      {visiveis.length > 0 && (
        <>
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-ms-main">Desempenho por turma <span className="font-normal text-ms-muted">({visiveis.length} redações corrigidas)</span></h3>
            <div className="border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ms-dark text-ms-muted text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Turma</th>
                    <th className="text-right px-3 py-2">Corrigidas</th>
                    <th className="text-right px-3 py-2">Média</th>
                    <th className="text-right px-3 py-2">Menor</th>
                    <th className="text-right px-3 py-2">Maior</th>
                    {FAIXAS.map((f) => <th key={f} className="text-right px-2 py-2 whitespace-nowrap">{f}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {turmas.map((t) => (
                    <tr key={t.turma} className="border-t border-gray-800">
                      <td className="px-3 py-2 text-ms-main font-medium">{t.turma}</td>
                      <td className="px-3 py-2 text-right text-ms-muted">{t.n}</td>
                      <td className="px-3 py-2 text-right text-ms-main font-bold">{f1(t.media)}%</td>
                      <td className="px-3 py-2 text-right text-ms-muted">{f1(t.min)}%</td>
                      <td className="px-3 py-2 text-right text-ms-muted">{f1(t.max)}%</td>
                      {t.faixas.map((n, i) => <td key={i} className="px-2 py-2 text-right text-ms-muted">{n || '·'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-ms-muted">Aproveitamento = nota confirmada ÷ nota máxima do modo de correção usado em cada redação.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-ms-main">Onde os alunos perderam mais pontos</h3>
            {[...new Set(criterios.map((c) => c.modo))].map((modo) => (
              <div key={modo} className="border border-gray-800 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-ms-muted">{modo}</p>
                {criterios.filter((c) => c.modo === modo).map((c) => (
                  <div key={c.chave} className="grid grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)] items-center gap-3 text-sm">
                    <span className="text-ms-main truncate" title={c.rotulo}>{c.rotulo} <span className="text-ms-muted text-xs">(até {c.max})</span></span>
                    <span className="text-right text-ms-main font-bold">{f1(c.media)}%</span>
                    <div className="space-y-0.5">
                      <Barra valor={c.media} cor={c.media < 50 ? 'bg-red-500' : c.media < 70 ? 'bg-amber-500' : 'bg-emerald-500'} />
                      <p className="text-[10px] text-ms-muted">{f1(c.abaixoMetade)}% abaixo da metade</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-[11px] text-ms-muted">Ordenados do critério mais fraco para o mais forte dentro de cada modo.</p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-ms-main">Prévia da IA × nota do professor</h3>
            {ia.n === 0 ? (
              <p className="text-sm text-ms-muted">Nenhuma destas redações teve prévia da IA.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { r: 'Redações comparadas', v: String(ia.n) },
                  { r: 'Critérios em que concordou com a IA', v: ia.concordancia != null ? `${f1(ia.concordancia)}%` : '—' },
                  { r: 'Diferença média (professor − IA)', v: ia.vies != null ? `${ia.vies > 0 ? '+' : ''}${f1(ia.vies)} p.p.` : '—' },
                  { r: 'Erro médio da IA', v: ia.erroAbsoluto != null ? `${f1(ia.erroAbsoluto)} p.p.` : '—' },
                ].map((c) => (
                  <div key={c.r} className="border border-gray-800 rounded-xl p-3">
                    <p className="text-lg font-bold text-ms-main">{c.v}</p>
                    <p className="text-[11px] text-ms-muted">{c.r}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-ms-muted">p.p. = pontos percentuais da nota máxima. Diferença negativa: a IA foi mais generosa que você.</p>
          </section>
        </>
      )}
    </div>
  );
}
