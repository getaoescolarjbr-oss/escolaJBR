import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, Printer, RefreshCw } from 'lucide-react';
import type { AusenciaServidor, LancamentoFolhaSubstituto, Substituicao } from '../../../types/rh';
import { listarAusencias } from '../../../services/rhService';
import { listarProfessoresParaSelecao, listarTurmas } from '../../../services/agendamentoService';
import { listarLancamentosFolhaIntervalo, listarSubstituicoesPeriodo } from '../../../services/folhaSubstitutoService';
import { consolidarRelatorio, gerarCsvPagamentos, gerarHtmlRelatorio, intervaloDoMes } from '../../../utils/relatorioSubstituicoes';
import { dataLonga, formatarHoras, imprimirHtml, rotuloCompetencia } from '../../../utils/folhaSubstituto';
import { BarrasPorTurma } from '../indicadores/BarrasPorTurma';

const COR = { sed: '#2563eb', part: '#16a34a', indef: '#f59e0b', barra: '#64748b' };
const classeInput = 'px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';
const h = (n: number) => formatarHoras(n) || '0h';

function Kpi({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-ms-card p-3">
      <p className="text-[11px] uppercase text-gray-500 font-bold">{rotulo}</p>
      <p className={`text-2xl font-black ${alerta ? 'text-amber-400' : 'text-ms-main'}`}>{valor}</p>
    </div>
  );
}

// Relatório de substituições e pagamentos: reúne os lançamentos da folha com os atestados
// (RH > Ausências) e as substituições por aula do período, em resumo, gráficos e tabelas,
// com impressão A4 e exportação dos pagamentos por substituto.
export function RelatorioSubstituicoes() {
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [de, setDe] = useState(mesAtual);
  const [ate, setAte] = useState(mesAtual);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoFolhaSubstituto[]>([]);
  const [atestados, setAtestados] = useState<AusenciaServidor[]>([]);
  const [substituicoes, setSubstituicoes] = useState<Substituicao[]>([]);
  const [professores, setProfessores] = useState<Map<string, string>>(new Map());
  const [turmas, setTurmas] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { inicio, fim } = intervaloDoMes(de, ate);
      const [l, a, s, p, t] = await Promise.all([
        listarLancamentosFolhaIntervalo(`${de}-01`, `${ate}-01`),
        listarAusencias(),
        listarSubstituicoesPeriodo(inicio, fim),
        listarProfessoresParaSelecao(),
        listarTurmas(),
      ]);
      setLancamentos(l); setAtestados(a); setSubstituicoes(s);
      setProfessores(new Map(p.map((x) => [x.id, x.nome])));
      setTurmas(Object.fromEntries(t.map((x) => [x.id, x.nome])));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o relatório.');
    } finally {
      setCarregando(false);
    }
  }, [de, ate]);

  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  const periodoValido = de <= ate;
  const r = useMemo(
    () => (periodoValido ? consolidarRelatorio({ lancamentos, atestados, substituicoes, professores, turmas, deComp: de, ateComp: ate }) : null),
    [lancamentos, atestados, substituicoes, professores, turmas, de, ate, periodoValido],
  );

  function exportarCsv() {
    if (!r) return;
    const blob = new Blob([gerarCsvPagamentos(r)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pagamentos-substitutos-${de}${de === ate ? '' : `_a_${ate}`}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const s = r?.resumo;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-gray-400">De (competência)</span>
          <input type="month" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} className={`${classeInput} mt-1 block`} /></label>
        <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Até</span>
          <input type="month" value={ate} min={de} onChange={(e) => e.target.value && setAte(e.target.value)} className={`${classeInput} mt-1 block`} /></label>
        <button onClick={carregar} className="flex items-center gap-1 px-3 py-2 text-xs text-gray-400 hover:text-ms-main" title="Recarregar"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</button>
        <div className="flex gap-2 ml-auto">
          <button onClick={() => r && imprimirHtml(gerarHtmlRelatorio(r, turmas, lancamentos))} disabled={!r || carregando}
            className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"><Printer className="w-4 h-4" /> Imprimir relatório</button>
          <button onClick={exportarCsv} disabled={!r || carregando || r.porSubstituto.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-ms-card border border-gray-800 text-ms-main rounded-lg text-sm font-bold hover:border-ms-blue disabled:opacity-40"><Download className="w-4 h-4" /> Pagamentos (CSV)</button>
        </div>
      </div>

      {!periodoValido && <p className="text-xs text-red-400">A competência final não pode ser anterior à inicial.</p>}
      {erro && <p className="text-xs text-red-400">{erro}</p>}
      {carregando && <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>}

      {!carregando && r && s && (
        <>
          <p className="text-xs text-gray-400">
            Competência <b className="text-ms-main">{de === ate ? rotuloCompetencia(`${de}-01`) : `${rotuloCompetencia(`${de}-01`)} a ${rotuloCompetencia(`${ate}-01`)}`}</b> · reúne a folha do substituto, os atestados/afastamentos e as substituições por aula.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Kpi rotulo="Lançamentos na folha" valor={String(s.lancamentos)} />
            <Kpi rotulo="CH total" valor={h(s.chTotal)} />
            <Kpi rotulo="Pago pela SED" valor={h(s.chSed)} />
            <Kpi rotulo="Particular" valor={h(s.chParticular)} />
            <Kpi rotulo="Pagamento a definir" valor={h(s.chIndefinida)} alerta={s.chIndefinida > 0} />
            <Kpi rotulo="Não lançados" valor={String(s.naoLancados)} alerta={s.naoLancados > 0} />
            <Kpi rotulo="Atestados / afastamentos" valor={`${s.atestados} · ${s.diasAfastamento} d`} />
            <Kpi rotulo="Sem substituto indicado" valor={String(s.atestadosSemSubstituto)} alerta={s.atestadosSemSubstituto > 0} />
          </div>

          {(s.atestadosSemSubstituto > 0 || s.substituicoesForaDaFolha > 0 || s.semCh > 0) && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {s.atestadosSemSubstituto > 0 && <p>{s.atestadosSemSubstituto} atestado(s)/afastamento(s) do período sem professor substituto indicado.</p>}
                {s.substituicoesForaDaFolha > 0 && <p>{s.substituicoesForaDaFolha} substituição(ões) por aula ainda fora do controle da folha (use “Importar” na visão Controle da folha).</p>}
                {s.semCh > 0 && <p>{s.semCh} lançamento(s) sem carga horária: não entram nos totais de horas.</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-1">
              <p className="text-[11px] uppercase font-bold text-[#2563eb]">Carga horária por substituto (SED · particular · a definir)</p>
              <BarrasPorTurma rotuloTotal="Total (h)" vazio="Nenhum lançamento no período."
                itens={r.porSubstituto.slice(0, 10).map((x) => ({ id: x.nome, rotulo: x.nome.split(' ').slice(0, 2).join(' '), partes: [
                  { nome: 'SED', valor: x.sed, cor: COR.sed }, { nome: 'Particular', valor: x.part, cor: COR.part }, { nome: 'A definir', valor: x.indef, cor: COR.indef }] }))} />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase font-bold text-[#2563eb]">{r.porMes.length > 1 ? 'Carga horária por mês' : 'Lançamentos por motivo'}</p>
              {r.porMes.length > 1 ? (
                <BarrasPorTurma rotuloTotal="Total (h)" itens={r.porMes.map((m) => ({ id: m.mes, rotulo: rotuloCompetencia(`${m.mes}-01`), partes: [
                  { nome: 'SED', valor: m.sed, cor: COR.sed }, { nome: 'Particular', valor: m.part, cor: COR.part }, { nome: 'A definir', valor: m.indef, cor: COR.indef }] }))} />
              ) : (
                <BarrasPorTurma vazio="Nenhum lançamento no período." itens={r.porMotivo.map((m) => ({ id: m.motivo, rotulo: m.motivo, partes: [{ nome: 'Lançamentos', valor: m.n, cor: COR.barra }] }))} />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase font-bold text-[#2563eb]">Titulares mais substituídos</p>
              <BarrasPorTurma rotuloTotal="Total (lanç.)" vazio="Nenhum lançamento no período."
                itens={r.porTitular.slice(0, 8).map((t) => ({ id: t.nome, rotulo: t.nome.split(' ')[0], partes: [{ nome: 'Lançamentos', valor: t.n, cor: COR.barra }] }))} />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase font-bold text-[#2563eb]">Atestados e substituições no período</p>
              <BarrasPorTurma rotuloTotal="Total" vazio="Nada no período." itens={[
                { id: 'a1', rotulo: 'Atestados c/ substituto', partes: [{ nome: 'Registros', valor: s.atestadosComSubstituto, cor: COR.part }] },
                { id: 'a2', rotulo: 'Atestados s/ substituto', partes: [{ nome: 'Registros', valor: s.atestadosSemSubstituto, cor: COR.indef }] },
                { id: 'a3', rotulo: 'Substituições por aula', partes: [{ nome: 'Registros', valor: s.substituicoes, cor: COR.sed }] },
                { id: 'a4', rotulo: 'Subst. fora da folha', partes: [{ nome: 'Registros', valor: s.substituicoesForaDaFolha, cor: COR.indef }] },
              ]} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main">Pagamentos por professor substituto</p>
            <div className="overflow-x-auto bg-ms-card border border-gray-800 rounded-2xl">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-800">
                  <th className="px-3 py-2">Substituto</th><th className="px-3 py-2 text-center">Lanç.</th><th className="px-3 py-2 text-center">CH SED</th>
                  <th className="px-3 py-2 text-center">CH particular</th><th className="px-3 py-2 text-center">A definir</th><th className="px-3 py-2 text-center">CH total</th><th className="px-3 py-2 text-center">A lançar</th></tr></thead>
                <tbody>
                  {r.porSubstituto.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-gray-500">Nenhum lançamento no período.</td></tr>
                  ) : (
                    <>
                      {r.porSubstituto.map((x) => (
                        <tr key={x.nome} className="border-b border-gray-800/60">
                          <td className="px-3 py-2 font-bold text-ms-main">{x.nome}</td><td className="px-3 py-2 text-center">{x.n}</td>
                          <td className="px-3 py-2 text-center">{h(x.sed)}</td><td className="px-3 py-2 text-center">{h(x.part)}</td>
                          <td className={`px-3 py-2 text-center ${x.indef ? 'text-amber-400' : ''}`}>{x.indef ? h(x.indef) : ''}</td>
                          <td className="px-3 py-2 text-center font-bold text-ms-main">{h(x.sed + x.part + x.indef)}</td>
                          <td className={`px-3 py-2 text-center ${x.pendentes ? 'text-amber-400' : ''}`}>{x.pendentes || ''}</td>
                        </tr>
                      ))}
                      <tr className="font-bold text-ms-main">
                        <td className="px-3 py-2">Total</td><td className="px-3 py-2 text-center">{s.lancamentos}</td><td className="px-3 py-2 text-center">{h(s.chSed)}</td>
                        <td className="px-3 py-2 text-center">{h(s.chParticular)}</td><td className="px-3 py-2 text-center">{s.chIndefinida ? h(s.chIndefinida) : ''}</td>
                        <td className="px-3 py-2 text-center">{h(s.chTotal)}</td><td className="px-3 py-2 text-center">{s.naoLancados || ''}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-ms-main">Atestados e afastamentos ({r.atestados.length})</p>
              <div className="overflow-x-auto bg-ms-card border border-gray-800 rounded-2xl">
                <table className="w-full text-xs min-w-[520px]">
                  <thead><tr className="text-left text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-800">
                    <th className="px-3 py-2">Servidor</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Período</th><th className="px-3 py-2 text-center">Dias</th><th className="px-3 py-2">Substituto</th><th className="px-3 py-2 text-center">Folha</th></tr></thead>
                  <tbody>
                    {r.atestados.length === 0 ? <tr><td colSpan={6} className="py-5 text-center text-gray-500">Nenhum no período.</td></tr> : r.atestados.map((a) => (
                      <tr key={a.id} className="border-b border-gray-800/60">
                        <td className="px-3 py-1.5 text-ms-main">{a.titular}</td><td className="px-3 py-1.5 text-gray-400">{a.tipo}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-400">{dataLonga(a.inicio)} a {dataLonga(a.fim)}</td><td className="px-3 py-1.5 text-center">{a.dias}</td>
                        <td className="px-3 py-1.5">{a.substituto ?? <span className="text-amber-400 font-bold">sem substituto</span>}</td>
                        <td className={`px-3 py-1.5 text-center ${a.substituto && !a.naFolha ? 'text-amber-400 font-bold' : ''}`}>{a.substituto ? (a.naFolha ? 'sim' : 'não') : '—'}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-ms-main">Substituições por aula ({r.substituicoes.length})</p>
              <div className="overflow-x-auto bg-ms-card border border-gray-800 rounded-2xl">
                <table className="w-full text-xs min-w-[520px]">
                  <thead><tr className="text-left text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-800">
                    <th className="px-3 py-2">Data</th><th className="px-3 py-2">Ausente</th><th className="px-3 py-2">Substituto</th><th className="px-3 py-2">Turma / aula</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2 text-center">Folha</th></tr></thead>
                  <tbody>
                    {r.substituicoes.length === 0 ? <tr><td colSpan={6} className="py-5 text-center text-gray-500">Nenhuma no período.</td></tr> : r.substituicoes.map((x) => (
                      <tr key={x.id} className="border-b border-gray-800/60">
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-400">{dataLonga(x.data)}</td><td className="px-3 py-1.5 text-ms-main">{x.titular}</td>
                        <td className="px-3 py-1.5">{x.substituto ?? <span className="text-amber-400 font-bold">em aberto</span>}</td><td className="px-3 py-1.5 text-gray-400">{x.turma}</td>
                        <td className="px-3 py-1.5 text-gray-400">{x.status}</td>
                        <td className={`px-3 py-1.5 text-center ${x.substituto && !x.naFolha ? 'text-amber-400 font-bold' : ''}`}>{x.substituto ? (x.naFolha ? 'sim' : 'não') : '—'}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
