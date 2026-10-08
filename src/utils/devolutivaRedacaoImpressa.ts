import type { RedacaoDetalhe } from '../services/redacaoService';
import { esc } from './relatorioResultados';

// Devolutiva impressa: uma página A4 por aluno, para anexar à folha de redação. Mostra só o que a avaliadora
// confirmou (a prévia da IA é sugestão e não aparece).

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; font-size: 10.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pag { padding: 4mm 2mm; }
  .pag + .pag { page-break-before: always; }
  .topo { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #002677; padding-bottom: 6px; margin-bottom: 10px; }
  .escola { font-size: 9pt; font-weight: 800; color: #002677; text-transform: uppercase; }
  .titulo { font-size: 15pt; font-weight: 900; }
  .sub { font-size: 9pt; color: #555; margin-top: 2px; }
  .aluno { background: #f0f4ff; border: 1px solid #c7d7f7; border-radius: 6px; padding: 7px 10px; margin-bottom: 10px; font-size: 10pt; }
  .aluno b { font-size: 11.5pt; }
  .tema { font-size: 9.5pt; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #002677; color: #fff; font-size: 8.5pt; padding: 5px 6px; text-align: left; }
  td { border: 1px solid #c9d2e8; padding: 5px 6px; vertical-align: top; font-size: 9.5pt; }
  td.n { text-align: center; font-weight: 800; white-space: nowrap; width: 22mm; }
  tr.total td { background: #eef3ff; font-weight: 900; font-size: 11pt; }
  .caixa { border: 1px solid #c9d2e8; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; }
  .caixa h4 { font-size: 9pt; text-transform: uppercase; color: #002677; margin-bottom: 4px; }
  .caixa p { white-space: pre-line; line-height: 1.4; }
  .texto { font-size: 9pt; line-height: 1.35; columns: 1; }
  .texto div { display: flex; gap: 6px; }
  .texto span.l { color: #888; width: 14px; text-align: right; flex-shrink: 0; }
  .rodape { margin-top: 8px; font-size: 7.5pt; color: #888; display: flex; justify-content: space-between; }
  @page { size: A4 portrait; margin: 12mm 12mm; }
`;

function nota(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

/** Uma página por redação confirmada. Devolve '' se a redação ainda não foi confirmada. */
export function htmlDevolutiva(det: RedacaoDetalhe, o: { tituloAvaliacao: string; numeroChamada: number | null; incluirTexto: boolean; justificativas: 'NAO' | 'IA' | 'SEM_IDENTIFICAR' }): string {
  const prof = det.correcao_prof;
  const rub = det.rubrica;
  if (!prof || !rub) return '';

  // Justificativa por competência vem da prévia da IA; só vale se foi gerada com a mesma rubrica da correção.
  const ia = det.correcao_ia && det.correcao_ia.rubrica?.id === rub.id ? det.correcao_ia : null;
  const comJustificativa = o.justificativas !== 'NAO' && !!ia;
  const rotuloJust = o.justificativas === 'IA' ? 'Justificativa (gerada por IA)' : 'Justificativa';
  const linhas = rub.criterios.map((c) => {
    const p = prof.competencias[c.chave];
    const j = ia?.competencias[c.chave]?.justificativa ?? '';
    return `<tr><td>${esc(c.rotulo)}</td><td class="n">${p ? nota(p.nota) : '—'} / ${nota(c.max)}</td>${comJustificativa ? `<td>${esc(j)}</td>` : ''}<td>${esc(p?.comentario ?? '')}</td></tr>`;
  }).join('');
  const maximo = rub.criterios.reduce((s, c) => s + c.max, 0);
  const total = det.nota_total ?? rub.criterios.reduce((s, c) => s + (prof.competencias[c.chave]?.nota ?? 0), 0);

  const texto = o.incluirTexto
    ? (det.texto_final ?? (det.linhas ?? []).map((l) => l.texto).join('\n')).split('\n')
    : [];
  const blocoTexto = texto.length
    ? `<div class="caixa"><h4>Texto transcrito</h4><div class="texto">${texto.map((t, i) => `<div><span class="l">${i + 1}</span><span>${esc(t)}</span></div>`).join('')}</div></div>`
    : '';
  const esperado = det.mostrar_esperado && det.observacoes
    ? `<div class="caixa"><h4>O que se esperava neste tema</h4><p>${esc(det.observacoes)}</p></div>`
    : '';

  return `<section class="pag">
    <div class="topo"><div><div class="escola">E.E. José Barbosa Rodrigues</div><div class="titulo">Devolutiva da redação</div><div class="sub">${esc(o.tituloAvaliacao)}</div></div></div>
    <div class="aluno"><b>${esc(det.aluno_nome)}</b> &nbsp;·&nbsp; ${esc(det.turma_nome ?? '')}${o.numeroChamada != null ? ` &nbsp;·&nbsp; Nº ${o.numeroChamada}` : ''}</div>
    ${det.tema ? `<div class="tema"><b>Tema:</b> ${esc(det.tema)}</div>` : ''}
    <table>
      <thead><tr><th>${esc(rub.nome)}</th><th>Nota</th>${comJustificativa ? `<th>${rotuloJust}</th>` : ''}<th>Comentário da avaliadora</th></tr></thead>
      <tbody>${linhas}<tr class="total"><td>Nota total</td><td class="n">${nota(total)} / ${nota(maximo)}</td>${comJustificativa ? '<td></td>' : ''}<td></td></tr></tbody>
    </table>
    ${prof.comentario_geral ? `<div class="caixa"><h4>Comentário geral</h4><p>${esc(prof.comentario_geral)}</p></div>` : ''}
    ${esperado}
    ${blocoTexto}
    <div class="rodape"><span>Portal do Professor JBR</span><span>Impresso em ${new Date().toLocaleDateString('pt-BR')}</span></div>
  </section>`;
}

export function abrirImpressaoDevolutivas(titulo: string, corpo: string): void {
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>${esc(titulo)}</title><style>${CSS}</style></head><body>${corpo}
  <script>window.onload = function () { window.print(); setTimeout(function () { window.close(); }, 500); };</script></body></html>`;
  const win = window.open('', '_blank', 'width=900,height=800');
  if (!win) {
    alert('Permita pop-ups para este site para poder imprimir.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
