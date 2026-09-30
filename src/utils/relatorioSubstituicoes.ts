import type { AusenciaServidor, LancamentoFolhaSubstituto, Substituicao, TipoAusencia } from '../types/rh';
import { ROTULO_PAGAMENTO, dataLonga, diasDoPeriodo, formatarHoras, nomesDasTurmas, rotuloCompetencia } from './folhaSubstituto';


const ROTULO_TIPO: Record<TipoAusencia, string> = { ATESTADO: 'Atestado médico', LICENCA: 'Licença', FERIAS: 'Férias', FALTA: 'Falta', OUTRO: 'Outro' };

export interface DadosRelatorio {
  lancamentos: LancamentoFolhaSubstituto[]; // já filtrados pela competência
  atestados: AusenciaServidor[];            // todos (o relatório filtra pelo período)
  substituicoes: Substituicao[];            // todas as do período
  professores: Map<string, string>;
  turmas: Record<string, string>;
  deComp: string;   // AAAA-MM
  ateComp: string;  // AAAA-MM
}

export interface LinhaSubstituto { nome: string; n: number; sed: number; part: number; indef: number; pendentes: number; semCh: number }
export interface LinhaAtestado { id: string; titular: string; tipo: string; inicio: string; fim: string; dias: number; ativo: boolean; substituto: string | null; naFolha: boolean }
export interface LinhaSubstituicao { id: string; data: string; titular: string; substituto: string | null; turma: string; status: string; naFolha: boolean }

export interface Relatorio {
  inicio: string;
  fim: string;
  resumo: {
    lancamentos: number; chTotal: number; chSed: number; chParticular: number; chIndefinida: number;
    naoLancados: number; semPagamento: number; semCh: number;
    atestados: number; atestadosComSubstituto: number; atestadosSemSubstituto: number; diasAfastamento: number;
    substituicoes: number; substituicoesComSubstituto: number; substituicoesForaDaFolha: number;
  };
  porSubstituto: LinhaSubstituto[];
  porMotivo: { motivo: string; n: number }[];
  porMes: { mes: string; sed: number; part: number; indef: number; n: number }[];
  porTitular: { nome: string; n: number; ch: number }[];
  atestados: LinhaAtestado[];
  substituicoes: LinhaSubstituicao[];
}

export function intervaloDoMes(deComp: string, ateComp: string): { inicio: string; fim: string } {
  const [ay, am] = ateComp.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ay, am, 0)).getUTCDate();
  return { inicio: `${deComp}-01`, fim: `${ateComp}-${String(ultimo).padStart(2, '0')}` };
}

const nomeOu = (m: Map<string, string>, id: string | null, padrao: string) => (id ? m.get(id) ?? padrao : padrao);

export function consolidarRelatorio(d: DadosRelatorio): Relatorio {
  const { inicio, fim } = intervaloDoMes(d.deComp, d.ateComp);
  const L = d.lancamentos;

  const sub = new Map<string, LinhaSubstituto>();
  const motivo = new Map<string, number>();
  const mes = new Map<string, { sed: number; part: number; indef: number; n: number }>();
  const tit = new Map<string, { nome: string; n: number; ch: number }>();
  let chSed = 0, chPart = 0, chIndef = 0;

  for (const l of L) {
    const ch = l.carga_horaria ?? 0;
    const k = l.substituto_nome.trim().toLowerCase();
    const s = sub.get(k) ?? { nome: l.substituto_nome.trim(), n: 0, sed: 0, part: 0, indef: 0, pendentes: 0, semCh: 0 };
    s.n++;
    if (l.pagamento === 'SED') { s.sed += ch; chSed += ch; }
    else if (l.pagamento === 'PARTICULAR') { s.part += ch; chPart += ch; }
    else { s.indef += ch; chIndef += ch; }
    if (!l.lancado_folha) s.pendentes++;
    if (l.carga_horaria === null) s.semCh++;
    sub.set(k, s);

    motivo.set(l.motivo, (motivo.get(l.motivo) ?? 0) + 1);

    const m = mes.get(l.competencia.slice(0, 7)) ?? { sed: 0, part: 0, indef: 0, n: 0 };
    m.n++;
    if (l.pagamento === 'SED') m.sed += ch; else if (l.pagamento === 'PARTICULAR') m.part += ch; else m.indef += ch;
    mes.set(l.competencia.slice(0, 7), m);

    const t = tit.get(l.titular_nome) ?? { nome: l.titular_nome, n: 0, ch: 0 };
    t.n++; t.ch += ch;
    tit.set(l.titular_nome, t);
  }

  const cobre = (l: LinhaPar, dia: string) => dia >= l.data && dia <= (l.data_fim ?? l.data);
  type LinhaPar = Pick<LancamentoFolhaSubstituto, 'data' | 'data_fim'>;

  const atestados: LinhaAtestado[] = d.atestados
    .filter((a) => a.data_inicio <= fim && a.data_fim >= inicio)
    .map((a) => ({
      id: a.id,
      titular: nomeOu(d.professores, a.professor_id, 'Servidor não encontrado'),
      tipo: ROTULO_TIPO[a.tipo] ?? a.tipo,
      inicio: a.data_inicio, fim: a.data_fim, dias: diasDoPeriodo(a.data_inicio, a.data_fim), ativo: a.ativo,
      substituto: a.substituto_id ? nomeOu(d.professores, a.substituto_id, 'Substituto') : null,
      naFolha: L.some((l) => l.atestado_id === a.id || (a.substituto_id !== null && l.titular_id === a.professor_id && l.substituto_id === a.substituto_id && l.data <= a.data_fim && (l.data_fim ?? l.data) >= a.data_inicio)),
    }))
    .sort((x, y) => y.inicio.localeCompare(x.inicio));

  const substituicoes: LinhaSubstituicao[] = d.substituicoes
    .filter((s) => s.data >= inicio && s.data <= fim)
    .map((s) => ({
      id: s.id, data: s.data,
      titular: nomeOu(d.professores, s.servidor_ausente_id, 'Servidor não encontrado'),
      substituto: s.substituto_id ? nomeOu(d.professores, s.substituto_id, 'Substituto') : null,
      turma: (s.turma_id ? d.turmas[s.turma_id] : null) ?? s.aula_ref ?? '—',
      status: s.status === 'FORMALIZADA_SED' ? 'Formalizada SED' : 'Arranjo interno',
      naFolha: s.substituto_id !== null && L.some((l) => l.substituicao_id === s.id || (l.titular_id === s.servidor_ausente_id && l.substituto_id === s.substituto_id && cobre(l, s.data))),
    }))
    .sort((x, y) => y.data.localeCompare(x.data));

  return {
    inicio, fim,
    resumo: {
      lancamentos: L.length, chTotal: chSed + chPart + chIndef, chSed, chParticular: chPart, chIndefinida: chIndef,
      naoLancados: L.filter((l) => !l.lancado_folha).length,
      semPagamento: L.filter((l) => !l.pagamento).length,
      semCh: L.filter((l) => l.carga_horaria === null).length,
      atestados: atestados.length,
      atestadosComSubstituto: atestados.filter((a) => a.substituto).length,
      atestadosSemSubstituto: atestados.filter((a) => !a.substituto).length,
      diasAfastamento: atestados.reduce((t, a) => t + a.dias, 0),
      substituicoes: substituicoes.length,
      substituicoesComSubstituto: substituicoes.filter((s) => s.substituto).length,
      substituicoesForaDaFolha: substituicoes.filter((s) => s.substituto && !s.naFolha).length,
    },
    porSubstituto: [...sub.values()].sort((a, b) => (b.sed + b.part + b.indef) - (a.sed + a.part + a.indef) || a.nome.localeCompare(b.nome, 'pt-BR')),
    porMotivo: [...motivo.entries()].map(([m, n]) => ({ motivo: m, n })).sort((a, b) => b.n - a.n),
    porMes: [...mes.entries()].map(([m, v]) => ({ mes: m, ...v })).sort((a, b) => a.mes.localeCompare(b.mes)),
    porTitular: [...tit.values()].sort((a, b) => b.n - a.n || b.ch - a.ch).slice(0, 10),
    atestados, substituicoes,
  };
}

// ---------------------------------------------------------------------------------------
// HTML do relatório impresso (A4 retrato): resumo, gráficos em barras CSS (imprimem sem
// biblioteca), pagamentos por substituto, atestados e substituições do período.
// ---------------------------------------------------------------------------------------
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const COR = { sed: '#2563eb', part: '#16a34a', indef: '#f59e0b', barra: '#64748b' };
const h = (n: number) => formatarHoras(n) || '0h';

function barras(itens: { rotulo: string; partes: { valor: number; cor: string }[]; texto: string }[], vazio = 'Sem dados no período.'): string {
  const max = Math.max(0, ...itens.map((i) => i.partes.reduce((a, p) => a + p.valor, 0)));
  if (itens.length === 0 || max === 0) return `<p class="vazio">${vazio}</p>`;
  return itens.map((i) => {
    const total = i.partes.reduce((a, p) => a + p.valor, 0);
    const segs = i.partes.filter((p) => p.valor > 0).map((p) => `<span style="width:${(p.valor / max) * 100}%;background:${p.cor}"></span>`).join('');
    return `<div class="linha"><div class="rot" title="${esc(i.rotulo)}">${esc(i.rotulo)}</div><div class="trilho">${segs}</div><div class="val">${esc(i.texto || String(total))}</div></div>`;
  }).join('');
}

export function gerarHtmlRelatorio(r: Relatorio, turmas: Record<string, string>, lancamentos: LancamentoFolhaSubstituto[]): string {
  const periodo = r.inicio.slice(0, 7) === r.fim.slice(0, 7) ? rotuloCompetencia(`${r.inicio.slice(0, 7)}-01`) : `${rotuloCompetencia(`${r.inicio.slice(0, 7)}-01`)} a ${rotuloCompetencia(`${r.fim.slice(0, 7)}-01`)}`;
  const s = r.resumo;
  const card = (rot: string, val: string, cor = '#0f172a') => `<div class="card"><div class="cv" style="color:${cor}">${val}</div><div class="cr">${rot}</div></div>`;

  const linhasSub = r.porSubstituto.map((x) => `<tr><td>${esc(x.nome)}</td><td class="c">${x.n}</td><td class="c">${h(x.sed)}</td><td class="c">${h(x.part)}</td><td class="c">${x.indef ? h(x.indef) : ''}</td><td class="c"><b>${h(x.sed + x.part + x.indef)}</b></td><td class="c">${x.pendentes || ''}</td></tr>`).join('');
  const totais = `<tr class="tot"><td>Total</td><td class="c">${s.lancamentos}</td><td class="c">${h(s.chSed)}</td><td class="c">${h(s.chParticular)}</td><td class="c">${s.chIndefinida ? h(s.chIndefinida) : ''}</td><td class="c">${h(s.chTotal)}</td><td class="c">${s.naoLancados || ''}</td></tr>`;

  const linhasLanc = lancamentos.map((l) => `<tr><td>${dataLonga(l.data)}${l.data_fim ? ` a ${dataLonga(l.data_fim)}` : ''}</td><td>${esc(l.substituto_nome)}</td><td>${esc(l.titular_nome)}</td><td>${esc(nomesDasTurmas(l.turma_ids, turmas))}</td><td>${esc(l.motivo)}</td><td class="c">${formatarHoras(l.carga_horaria)}</td><td class="c">${l.pagamento ? ROTULO_PAGAMENTO[l.pagamento] : 'a definir'}</td><td class="c">${l.lancado_folha ? 'sim' : 'não'}</td></tr>`).join('');

  const linhasAt = r.atestados.map((a) => `<tr><td>${esc(a.titular)}</td><td>${esc(a.tipo)}</td><td>${dataLonga(a.inicio)} a ${dataLonga(a.fim)}</td><td class="c">${a.dias}</td><td>${a.substituto ? esc(a.substituto) : '<b class="alerta">sem substituto</b>'}</td><td class="c">${a.substituto ? (a.naFolha ? 'sim' : '<b class="alerta">não</b>') : '—'}</td></tr>`).join('');
  const linhasSb = r.substituicoes.map((x) => `<tr><td>${dataLonga(x.data)}</td><td>${esc(x.titular)}</td><td>${x.substituto ? esc(x.substituto) : '<b class="alerta">em aberto</b>'}</td><td>${esc(x.turma)}</td><td>${esc(x.status)}</td><td class="c">${x.substituto ? (x.naFolha ? 'sim' : '<b class="alerta">não</b>') : '—'}</td></tr>`).join('');

  const maxMes = r.porMes.length > 1;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<title>Relatório de substituições e pagamentos - ${esc(periodo)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 12mm 12mm; font-size: 9.5pt; line-height: 1.35; }
  .cab { text-align: center; border-bottom: 0.4mm solid #0f172a; padding-bottom: 3mm; margin-bottom: 4mm; }
  .cab .esc { font-size: 10pt; font-weight: bold; text-transform: uppercase; color: #334155; }
  .cab h1 { font-size: 14pt; margin: 1mm 0; }
  .cab .per { font-size: 10pt; }
  h2 { font-size: 10.5pt; margin: 5mm 0 2mm; padding-bottom: 1mm; border-bottom: 0.3mm solid #94a3b8; text-transform: uppercase; color: #1e293b; }
  .cards { display: flex; flex-wrap: wrap; gap: 2mm; }
  .card { flex: 1 1 22%; border: 0.3mm solid #cbd5e1; border-radius: 1.5mm; padding: 2mm 2.5mm; }
  .cv { font-size: 14pt; font-weight: 800; } .cr { font-size: 7.5pt; text-transform: uppercase; color: #64748b; }
  .graf { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .graf h3 { font-size: 8.5pt; text-transform: uppercase; color: #475569; margin-bottom: 1.5mm; }
  .linha { display: flex; align-items: center; gap: 2mm; margin-bottom: 1.2mm; }
  .rot { width: 30%; font-size: 8pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .trilho { flex: 1; height: 3.6mm; background: #f1f5f9; border-radius: 1mm; display: flex; overflow: hidden; }
  .trilho span { display: block; height: 100%; }
  .val { width: 16%; font-size: 8pt; text-align: right; font-weight: bold; }
  .leg { font-size: 7.5pt; color: #475569; margin-top: 1mm; } .leg i { display: inline-block; width: 2.5mm; height: 2.5mm; border-radius: 0.5mm; margin: 0 1mm 0 3mm; vertical-align: -0.4mm; }
  .vazio { font-size: 8pt; color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; margin-top: 1mm; }
  th, td { border: 0.25mm solid #94a3b8; padding: 1mm 1.5mm; font-size: 8.3pt; vertical-align: top; }
  th { background: #e2e8f0; text-align: left; text-transform: uppercase; font-size: 7.6pt; }
  td.c, th.c { text-align: center; } tr.tot td { background: #f1f5f9; font-weight: bold; }
  tr { page-break-inside: avoid; } thead { display: table-header-group; }
  .alerta { color: #b45309; }
  .nota { font-size: 7.5pt; color: #64748b; margin-top: 1.5mm; }
  .rod { margin-top: 6mm; font-size: 7.5pt; color: #64748b; text-align: right; }
  @media print { @page { size: A4 portrait; margin: 0; } h2 { page-break-after: avoid; } }
</style></head><body>
<div class="cab"><div class="esc">E.E. José Barbosa Rodrigues</div><h1>Relatório de substituições e pagamentos</h1><div class="per">Competência: <b>${esc(periodo)}</b></div></div>

<h2>Resumo</h2>
<div class="cards">
  ${card('Lançamentos na folha', String(s.lancamentos))}
  ${card('Carga horária total', h(s.chTotal))}
  ${card('Pago pela SED', h(s.chSed), COR.sed)}
  ${card('Particular', h(s.chParticular), COR.part)}
  ${card('Forma de pagamento a definir', h(s.chIndefinida), s.chIndefinida ? COR.indef : '#0f172a')}
  ${card('Não lançados na folha', String(s.naoLancados), s.naoLancados ? COR.indef : '#0f172a')}
  ${card('Atestados/afastamentos', `${s.atestados}<span style="font-size:8pt;font-weight:400"> · ${s.diasAfastamento} dias</span>`)}
  ${card('Sem substituto indicado', String(s.atestadosSemSubstituto), s.atestadosSemSubstituto ? COR.indef : '#0f172a')}
</div>

<h2>Gráficos</h2>
<div class="graf">
  <div><h3>Carga horária por substituto</h3>
    ${barras(r.porSubstituto.slice(0, 10).map((x) => ({ rotulo: x.nome, partes: [{ valor: x.sed, cor: COR.sed }, { valor: x.part, cor: COR.part }, { valor: x.indef, cor: COR.indef }], texto: h(x.sed + x.part + x.indef) })))}
    <div class="leg"><i style="background:${COR.sed}"></i>SED<i style="background:${COR.part}"></i>Particular<i style="background:${COR.indef}"></i>A definir</div></div>
  <div><h3>${maxMes ? 'Carga horária por mês' : 'Lançamentos por motivo'}</h3>
    ${maxMes
      ? barras(r.porMes.map((m) => ({ rotulo: rotuloCompetencia(`${m.mes}-01`), partes: [{ valor: m.sed, cor: COR.sed }, { valor: m.part, cor: COR.part }, { valor: m.indef, cor: COR.indef }], texto: h(m.sed + m.part + m.indef) })))
      : barras(r.porMotivo.map((m) => ({ rotulo: m.motivo, partes: [{ valor: m.n, cor: COR.barra }], texto: String(m.n) })))}</div>
  <div><h3>Mais substituídos (titulares)</h3>
    ${barras(r.porTitular.slice(0, 8).map((t) => ({ rotulo: t.nome, partes: [{ valor: t.n, cor: COR.barra }], texto: `${t.n} lanç.` })))}</div>
  <div><h3>Atestados e substituições no período</h3>
    ${barras([
      { rotulo: 'Atestados c/ substituto', partes: [{ valor: s.atestadosComSubstituto, cor: COR.part }], texto: String(s.atestadosComSubstituto) },
      { rotulo: 'Atestados s/ substituto', partes: [{ valor: s.atestadosSemSubstituto, cor: COR.indef }], texto: String(s.atestadosSemSubstituto) },
      { rotulo: 'Subst. por aula', partes: [{ valor: s.substituicoes, cor: COR.sed }], texto: String(s.substituicoes) },
      { rotulo: 'Subst. fora da folha', partes: [{ valor: s.substituicoesForaDaFolha, cor: COR.indef }], texto: String(s.substituicoesForaDaFolha) },
    ])}</div>
</div>

<h2>Pagamentos por professor substituto</h2>
<table><thead><tr><th>Substituto</th><th class="c">Lanç.</th><th class="c">CH SED</th><th class="c">CH particular</th><th class="c">A definir</th><th class="c">CH total</th><th class="c">A lançar</th></tr></thead>
<tbody>${linhasSub || '<tr><td colspan="7" class="vazio">Nenhum lançamento no período.</td></tr>'}${linhasSub ? totais : ''}</tbody></table>
${s.semCh ? `<p class="nota">${s.semCh} lançamento(s) sem carga horária informada não entram nos totais de horas.</p>` : ''}

<h2>Lançamentos do período</h2>
<table><thead><tr><th>Data / período</th><th>Substituto</th><th>Titular</th><th>Turmas</th><th>Motivo</th><th class="c">CH</th><th class="c">Pagamento</th><th class="c">Lançado</th></tr></thead>
<tbody>${linhasLanc || '<tr><td colspan="8" class="vazio">Nenhum lançamento no período.</td></tr>'}</tbody></table>

<h2>Atestados e afastamentos do período</h2>
<table><thead><tr><th>Servidor</th><th>Tipo</th><th>Período</th><th class="c">Dias</th><th>Substituto</th><th class="c">Na folha</th></tr></thead>
<tbody>${linhasAt || '<tr><td colspan="6" class="vazio">Nenhum atestado ou afastamento no período.</td></tr>'}</tbody></table>

<h2>Substituições por aula (RH)</h2>
<table><thead><tr><th>Data</th><th>Servidor ausente</th><th>Substituto</th><th>Turma / aula</th><th>Situação</th><th class="c">Na folha</th></tr></thead>
<tbody>${linhasSb || '<tr><td colspan="6" class="vazio">Nenhuma substituição registrada no período.</td></tr>'}</tbody></table>

<p class="rod">Emitido em ${new Date().toLocaleString('pt-BR')} · dado pessoal e de saúde: uso interno da secretaria e da gestão</p>
</body></html>`;
}

// CSV dos pagamentos por substituto (Excel brasileiro: ";" e BOM).
export function gerarCsvPagamentos(r: Relatorio): string {
  const cel = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const n = (x: number) => String(x).replace('.', ',');
  const cab = ['Substituto', 'Lançamentos', 'CH SED (h)', 'CH particular (h)', 'CH a definir (h)', 'CH total (h)', 'A lançar na folha', 'Sem CH'];
  const linhas = r.porSubstituto.map((x) => [x.nome, String(x.n), n(x.sed), n(x.part), n(x.indef), n(x.sed + x.part + x.indef), String(x.pendentes), String(x.semCh)].map(cel).join(';'));
  return '\uFEFF' + [cab.map(cel).join(';'), ...linhas].join('\r\n');
}
