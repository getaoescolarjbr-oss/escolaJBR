import type { LancamentoFolhaSubstituto, PagamentoSubstituto } from '../types/rh';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const MOTIVOS_SUGERIDOS = ['Atestado', 'Licença', 'Férias', 'Folga', 'Folga eleitoral', 'Revogação', 'Readaptação', 'Doença na família', 'Não houve'];

export const ROTULO_PAGAMENTO: Record<PagamentoSubstituto, string> = { SED: 'SED', PARTICULAR: 'Particular' };

// "2026-09-01" -> "Setembro/2026"
export function rotuloCompetencia(competencia: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(competencia);
  return m ? `${MESES[Number(m[2]) - 1]}/${m[1]}` : competencia;
}

export function dataCurta(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[1]}` : iso;
}

export function dataLonga(iso: string): string {
  return iso.split('-').reverse().join('/');
}

export function diasDoPeriodo(inicio: string, fim: string | null): number {
  if (!fim) return 1;
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000) + 1;
}

// Dia único: "09/09". Período: "17/09 a 03/10 (15 dias)". O complemento livre (manhã, vespertino...) vai junto.
export function rotuloPeriodo(l: Pick<LancamentoFolhaSubstituto, 'data' | 'data_fim' | 'periodo'>): string {
  const base = l.data_fim && l.data_fim !== l.data ? `${dataCurta(l.data)} a ${dataCurta(l.data_fim)} (${diasDoPeriodo(l.data, l.data_fim)} dias)` : '';
  return [base, l.periodo].filter(Boolean).join(' · ');
}

export function formatarHoras(h: number | null): string {
  if (h === null || h === undefined) return '';
  return `${String(h).replace('.', ',')}h`;
}

// Aceita "8", "3,75", "3.75" e "8h"; vazio vira null; inválido vira NaN.
export function lerHoras(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/h$/, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export function situacaoTexto(l: LancamentoFolhaSubstituto): string {
  const partes: string[] = [];
  if (l.termo_ok) partes.push('Termo ok');
  if (l.justificativa_ok) partes.push('Just. ok');
  if (l.lancado_folha) partes.push('Lançado');
  if (l.observacoes) partes.push(l.observacoes);
  return partes.join(' · ');
}

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Folha de controle impressa, no mesmo desenho do papel (título, competência e colunas),
// completada com linhas em branco até preencher a página para quem quiser escrever à mão.
export function gerarHtmlControleFolha(lancamentos: LancamentoFolhaSubstituto[], competencia: string): string {
  const LINHAS_MIN = 30;
  const linhas = lancamentos.map((l) => `<tr>
      <td>${dataCurta(l.data)}</td><td>${esc(l.substituto_nome)}</td><td>${esc(l.titular_nome)}</td>
      <td>${esc(l.motivo)}</td><td>${esc(rotuloPeriodo({ data: l.data, data_fim: l.data_fim, periodo: l.periodo }).replace(/^\d\d\/\d\d$/, ''))}</td>
      <td class="c">${formatarHoras(l.carga_horaria)}</td><td class="c">${l.pagamento ? ROTULO_PAGAMENTO[l.pagamento] : ''}</td>
      <td class="sit">${esc(situacaoTexto(l))}</td></tr>`);
  for (let i = linhas.length; i < LINHAS_MIN; i++) linhas.push('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<title>Controle de lançamento de folha - ${esc(rotuloCompetencia(competencia))}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; padding: 14mm 10mm; font-size: 10pt; }
  h1 { text-align: center; font-size: 12pt; text-transform: uppercase; margin-bottom: 4mm; }
  .comp { text-align: center; margin-bottom: 6mm; font-size: 11pt; }
  .comp b { border-bottom: 0.3mm solid #000; padding: 0 6mm; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th, td { border: 0.3mm solid #000; padding: 1.2mm 1.6mm; height: 7.6mm; vertical-align: middle; }
  th { font-size: 8.5pt; text-align: left; text-transform: uppercase; }
  td.c { text-align: center; }
  td.sit { font-size: 8.5pt; }
  tr { page-break-inside: avoid; }
  @media print { @page { size: A4 portrait; margin: 0; } }
</style></head><body>
<h1>Controle de lançamento de folha – Professor substituto</h1>
<p class="comp">COMPETÊNCIA <b>${esc(rotuloCompetencia(competencia))}</b></p>
<table>
  <thead><tr>
    <th style="width:9%">Data</th><th style="width:18%">Professor substituto</th><th style="width:18%">Professor titular</th>
    <th style="width:11%">Motivo</th><th style="width:18%">Período</th><th style="width:6%">CH</th><th style="width:8%">Pgto</th><th style="width:12%">Situação</th>
  </tr></thead>
  <tbody>${linhas.join('')}</tbody>
</table>
</body></html>`;
}

// CSV para Excel brasileiro: separador ";" e BOM para acentos.
export function gerarCsvControleFolha(lancamentos: LancamentoFolhaSubstituto[]): string {
  const cab = ['Data início', 'Data fim', 'Professor substituto', 'Professor titular', 'Motivo', 'Complemento do período', 'CH (horas)', 'Pagamento', 'Termo ok', 'Justificativa ok', 'Lançado/pago', 'Observações'];
  const cel = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const linhas = lancamentos.map((l) => [
    dataLonga(l.data), l.data_fim ? dataLonga(l.data_fim) : '', l.substituto_nome, l.titular_nome, l.motivo, l.periodo ?? '',
    l.carga_horaria === null ? '' : String(l.carga_horaria).replace('.', ','), l.pagamento ? ROTULO_PAGAMENTO[l.pagamento] : 'a definir',
    l.termo_ok ? 'sim' : 'não', l.justificativa_ok ? 'sim' : 'não', l.lancado_folha ? 'sim' : 'não', l.observacoes ?? '',
  ].map(cel).join(';'));
  return '\uFEFF' + [cab.map(cel).join(';'), ...linhas].join('\r\n');
}

export function imprimirHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 60000);
  };
  iframe.srcdoc = html;
}
