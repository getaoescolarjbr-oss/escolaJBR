import type { QuestaoInfoRelatorio, ResultadoAlunoDetalhado } from '../types/avaliacoes';

// Cálculos e impressão do relatório de resultados de uma avaliação (AvaliacaoResultadosModal).
//
// Numa prova com versões embaralhadas, a letra que o aluno marcou é a BOLHA da folha dele, e a mesma posição
// da folha tem outra questão (e outra bolha correta) em cada versão. Por isso a matriz de respostas é
// agrupada por versão: cada bloco usa a numeração e o gabarito da própria versão.

export interface EstatisticaQuestao {
  question_id: string;
  ordem: number;
  correct_letter: string;
  valor: number;
  totalRespostas: number;
  totalAcertos: number;
  totalErros: number;
  pctAcerto: number;
}

export function calcularEstatisticasQuestoes(alunosGrupo: ResultadoAlunoDetalhado[], questoes: QuestaoInfoRelatorio[]): EstatisticaQuestao[] {
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

// ---- versões (provas embaralhadas) -------------------------------------------------------------

export interface LinhaVersao {
  question_id: string;
  numero_na_prova: number;
  bolha_correta: string | null;
  qtd_alternativas: number;
}

export interface VersaoRelatorio {
  rotulo: string;
  linhas: LinhaVersao[];
}

export interface VersoesRelatorio {
  versoes: VersaoRelatorio[];
  /** aluno_id -> rótulo da versão que ele recebeu. */
  versaoDoAluno: Record<string, string>;
}

export const SEM_VERSOES: VersoesRelatorio = { versoes: [], versaoDoAluno: {} };

/** Gabarito de uma questão para a coluna "Gabarito": a letra do banco, ou uma por versão quando há versões. */
export function gabaritoTexto(question_id: string, letraBanco: string | undefined, v: VersoesRelatorio): string {
  const porVersao = v.versoes
    .map((ver) => ({ rotulo: ver.rotulo, bolha: ver.linhas.find((l) => l.question_id === question_id)?.bolha_correta }))
    .filter((x) => x.bolha);
  if (porVersao.length === 0) return letraBanco || '—';
  return porVersao.map((x) => `${x.rotulo}:${x.bolha}`).join(' ');
}

// ---- alunos: nome ou código, ordem ---------------------------------------------------------------

/** Como o aluno aparece: o nome, ou — para mural sem nomes — o código SGDE (ou o nº de chamada, se faltar). */
export function identificacaoAluno(al: ResultadoAlunoDetalhado, mostrarNomes: boolean): string {
  if (mostrarNomes) return al.aluno_nome;
  if (al.codigo_sgde) return al.codigo_sgde;
  return al.numero_chamada != null ? `Nº ${al.numero_chamada} (sem SGDE)` : 'Sem SGDE';
}

export function ordenarAlunos(lista: ResultadoAlunoDetalhado[], mostrarNomes: boolean): ResultadoAlunoDetalhado[] {
  const copia = [...lista];
  if (mostrarNomes) return copia.sort((a, b) => a.aluno_nome.localeCompare(b.aluno_nome, 'pt-BR'));
  // Sem nomes a ordem não pode revelar quem é quem pelo alfabeto: vai pelo código.
  return copia.sort((a, b) => {
    if (a.codigo_sgde && b.codigo_sgde) return a.codigo_sgde.localeCompare(b.codigo_sgde, 'pt-BR', { numeric: true });
    if (a.codigo_sgde) return -1; // quem tem código vem antes de quem não tem
    if (b.codigo_sgde) return 1;
    return (a.numero_chamada ?? 0) - (b.numero_chamada ?? 0);
  });
}

// ---- matriz agrupada por versão ------------------------------------------------------------------

export interface ColunaMatriz {
  question_id: string;
  /** Número da questão na folha da versão (ou na ordem da avaliação, sem versões). */
  numero: number;
  gabarito: string;
}

export interface BlocoMatriz {
  /** null = alunos sem versão (prova online ou sem folha): numeração e gabarito do banco. */
  rotulo: string | null;
  colunas: ColunaMatriz[];
  alunos: ResultadoAlunoDetalhado[];
}

export function blocosMatriz(alunosTurma: ResultadoAlunoDetalhado[], questoes: QuestaoInfoRelatorio[], v: VersoesRelatorio): BlocoMatriz[] {
  const colunasBanco: ColunaMatriz[] = questoes.map((q) => ({ question_id: q.question_id, numero: q.ordem, gabarito: q.correct_letter || '—' }));
  if (v.versoes.length === 0) return alunosTurma.length ? [{ rotulo: null, colunas: colunasBanco, alunos: alunosTurma }] : [];

  const blocos: BlocoMatriz[] = [];
  for (const ver of v.versoes) {
    const alunos = alunosTurma.filter((a) => v.versaoDoAluno[a.aluno_id] === ver.rotulo);
    if (alunos.length === 0) continue;
    blocos.push({
      rotulo: ver.rotulo,
      colunas: ver.linhas.map((l) => ({ question_id: l.question_id, numero: l.numero_na_prova, gabarito: l.bolha_correta || '—' })),
      alunos,
    });
  }
  const semVersao = alunosTurma.filter((a) => !v.versaoDoAluno[a.aluno_id]);
  if (semVersao.length) blocos.push({ rotulo: null, colunas: colunasBanco, alunos: semVersao });
  return blocos;
}

// ---- impressão (documento próprio, sem depender do CSS da tela) ----------------------------------

export const esc = (s: string | number | null | undefined): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const f1 = (n: number) => n.toFixed(1);

function corBarraHex(pct: number): string {
  if (pct >= 70) return '#10b981';
  if (pct >= 40) return '#f59e0b';
  return '#ef4444';
}

export interface ResumoTurmaImpressao {
  turma: string;
  enviadas: number;
  total: number;
  mediaAcertos: number;
  mediaNota: number;
}

export interface DadosImpressao {
  totalQuestoes: number;
  mostrarNomes: boolean;
  ponderada: boolean;
  areasTri: string[];
  versoes: VersoesRelatorio;
  questoes: QuestaoInfoRelatorio[];
}

/** "Visão geral": uma tabela por turma com acertos, nota e situação de cada aluno. */
export function htmlVisaoGeral(turma: string, alunosTurma: ResultadoAlunoDetalhado[], resumo: ResumoTurmaImpressao, d: DadosImpressao): string {
  const linhas = ordenarAlunos(alunosTurma, d.mostrarNomes).map((al, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td class="esq">${esc(identificacaoAluno(al, d.mostrarNomes))}</td>
      ${d.mostrarNomes ? `<td>${esc(al.codigo_sgde ?? '—')}</td>` : ''}
      <td>${al.finalizado_em ? `${al.total_acertos} / ${al.total_questoes}` : '—'}</td>
      <td>${al.finalizado_em ? (al.nota ?? 0).toFixed(2) : '—'}</td>
      ${d.ponderada ? `<td>${al.finalizado_em && al.nota_tri != null ? al.nota_tri.toFixed(2) : '—'}</td>${d.areasTri.map((a) => `<td>${al.finalizado_em && al.nota_tri_areas?.[a] != null ? al.nota_tri_areas[a].toFixed(2) : '—'}</td>`).join('')}` : ''}
      <td>${al.finalizado_em ? 'Enviada' : 'Pendente'}</td>
    </tr>`).join('');
  return `
  <section class="turma">
    <h2>${esc(turma)} <small>${resumo.enviadas}/${resumo.total} enviaram · média ${f1(resumo.mediaAcertos)}/${d.totalQuestoes} acertos · nota média ${resumo.mediaNota.toFixed(2)}</small></h2>
    <table>
      <thead><tr>
        <th>Nº</th><th class="esq">${d.mostrarNomes ? 'Aluno' : 'Código SGDE'}</th>${d.mostrarNomes ? '<th>SGDE</th>' : ''}
        <th>Acertos</th><th>Nota</th>${d.ponderada ? `<th>TRI Geral</th>${d.areasTri.map((a) => `<th>TRI ${esc(a)}</th>`).join('')}` : ''}<th>Status</th>
      </tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  </section>`;
}

/** "Acertos por questão": tabela com a barra de acerto dentro da própria linha, em duas colunas quando é longa. */
export function htmlAcertos(titulo: string, subtitulo: string, dados: EstatisticaQuestao[], d: DadosImpressao): string {
  const bloco = (parte: EstatisticaQuestao[]) => `
    <table class="acertos">
      <thead><tr><th class="esq">Questão</th><th>Gab.</th><th>Resp.</th><th>Acertos</th><th>Erros</th><th>%</th><th class="barra-col">Acerto</th></tr></thead>
      <tbody>${parte.map((q) => `
        <tr>
          <td class="esq">Questão ${q.ordem}</td>
          <td class="gab">${esc(gabaritoTexto(q.question_id, q.correct_letter, d.versoes))}</td>
          <td>${q.totalRespostas}</td><td class="ok">${q.totalAcertos}</td><td class="err">${q.totalErros}</td>
          <td><b>${q.pctAcerto.toFixed(0)}%</b></td>
          <td class="barra-col"><div class="barra"><div class="cheio" style="width:${Math.max(q.pctAcerto, q.totalRespostas > 0 ? 3 : 0)}%;background:${corBarraHex(q.pctAcerto)}"></div></div></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  const metade = Math.ceil(dados.length / 2);
  const corpo = dados.length > 24
    ? `<div class="duas-colunas">${bloco(dados.slice(0, metade))}${bloco(dados.slice(metade))}</div>`
    : bloco(dados);
  return `<section class="turma"><h2>${esc(titulo)} <small>${esc(subtitulo)}</small></h2>${corpo}</section>`;
}

/** "Matriz de respostas": um bloco por versão, com a numeração e o gabarito da própria versão. */
export function htmlMatriz(turma: string, alunosTurma: ResultadoAlunoDetalhado[], d: DadosImpressao): string {
  const blocos = blocosMatriz(ordenarAlunos(alunosTurma, d.mostrarNomes), d.questoes, d.versoes);
  const POR_FAIXA = 30; // até 30 questões por faixa: cabe na largura da folha e continua legível no mural
  const partes = blocos.map((b) => {
    const faixas: ColunaMatriz[][] = [];
    for (let i = 0; i < b.colunas.length; i += POR_FAIXA) faixas.push(b.colunas.slice(i, i + POR_FAIXA));
    const titulo = b.rotulo ? `Versão ${esc(b.rotulo)}` : (d.versoes.versoes.length ? 'Sem versão (sem folha)' : '');
    const tabelas = faixas.map((cols) => `
      <table class="matriz">
        <thead>
          <tr><th class="esq">${d.mostrarNomes ? 'Aluno' : 'Código SGDE'}</th><th>Ac.</th>${cols.map((c) => `<th>${c.numero}</th>`).join('')}</tr>
          <tr class="gabarito"><th class="esq">Gabarito${b.rotulo ? ` ${esc(b.rotulo)}` : ''}</th><th></th>${cols.map((c) => `<th>${esc(c.gabarito)}</th>`).join('')}</tr>
        </thead>
        <tbody>${b.alunos.map((al) => `
          <tr>
            <td class="esq">${esc(identificacaoAluno(al, d.mostrarNomes))}</td>
            <td>${al.finalizado_em ? `${al.total_acertos}/${al.total_questoes}` : '—'}</td>
            ${cols.map((c) => {
              if (!al.finalizado_em) return '<td class="vazio">—</td>';
              const r = al.respostas[c.question_id];
              if (!r?.letra_marcada) return '<td class="vazio">-</td>';
              return `<td class="${r.correta ? 'c-ok' : 'c-err'}">${esc(r.letra_marcada)}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>`).join('');
    return `${titulo ? `<h3>${titulo} <small>${b.alunos.length} aluno(s)</small></h3>` : ''}${tabelas}`;
  }).join('');
  return `<section class="turma"><h2>${esc(turma)}</h2>${partes}</section>`;
}

export const CSS_IMPRESSAO = `
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1a1a2e; background: #fff; padding: 14px; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #002677; padding-bottom: 10px; margin-bottom: 12px; }
  .escola { font-size: 15px; font-weight: 900; color: #002677; text-transform: uppercase; }
  .titulo { font-size: 12px; font-weight: 700; color: #003366; margin-top: 2px; }
  .subtitulo { font-size: 9px; font-weight: 600; color: #666; margin-top: 2px; text-transform: uppercase; }
  .meta { text-align: right; font-size: 8px; color: #666; font-weight: 600; }
  .info { display: flex; flex-wrap: wrap; gap: 14px; background: #f0f4ff; border: 1px solid #c7d7f7; border-radius: 6px; padding: 7px 12px; margin-bottom: 10px; }
  .info div { display: flex; flex-direction: column; }
  .info b { font-size: 7.5px; color: #002677; text-transform: uppercase; letter-spacing: .6px; }
  .info span { font-size: 10.5px; font-weight: 700; }
  section.turma { margin-bottom: 14px; }
  section.turma + section.turma { page-break-before: always; }
  h2 { font-size: 12px; color: #002677; margin: 4px 0 6px; } h2 small, h3 small { font-size: 8.5px; font-weight: 600; color: #666; margin-left: 6px; }
  h3 { font-size: 10.5px; color: #003366; margin: 8px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead { display: table-header-group; }
  thead th { background: #002677; color: #fff; font-size: 8px; text-transform: uppercase; letter-spacing: .4px; padding: 5px 5px; border: 1px solid #001a55; text-align: center; }
  tbody td { padding: 3.5px 5px; border: 1px solid #dde4f5; text-align: center; font-weight: 600; }
  tbody tr:nth-child(even) td { background: #f7f9ff; }
  tr { page-break-inside: avoid; }
  .esq { text-align: left !important; }
  td.n { width: 24px; color: #888; }
  .duas-colunas { display: flex; gap: 12px; align-items: flex-start; } .duas-colunas table { flex: 1; }
  table.acertos td.gab { font-weight: 800; color: #047857; }
  table.acertos .ok { color: #047857; font-weight: 800; } table.acertos .err { color: #b91c1c; font-weight: 800; }
  .barra-col { width: 28%; } .barra { height: 8px; background: #e5e7eb; border-radius: 3px; overflow: hidden; } .cheio { height: 100%; }
  table.matriz { table-layout: auto; font-size: 8.5px; }
  table.matriz thead th { padding: 3px 2px; font-size: 7.5px; min-width: 15px; }
  table.matriz thead th.esq { min-width: 110px; }
  table.matriz tr.gabarito th { background: #065f46; border-color: #064e3b; font-size: 8.5px; }
  table.matriz td { padding: 2.5px 2px; font-size: 8.5px; }
  td.c-ok { background: #d1fae5 !important; color: #065f46; font-weight: 800; }
  td.c-err { background: #fee2e2 !important; color: #991b1b; font-weight: 800; }
  td.vazio { color: #9ca3af; }
  .rodape { margin-top: 12px; padding-top: 6px; border-top: 1px solid #dde4f5; display: flex; justify-content: space-between; font-size: 7.5px; color: #999; font-weight: 600; }
  @page { size: A4 landscape; margin: 10mm 8mm; }
`;

/** Abre a janela de impressão com o relatório já montado em HTML. */
export function abrirImpressao(o: { titulo: string; subtitulo?: string; info: { label: string; value: string }[]; corpo: string }) {
  const agora = new Date();
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>${esc(o.titulo)}</title><style>${CSS_IMPRESSAO}</style></head><body>
  <div class="topo">
    <div><div class="escola">Portal JBR — José Barbosa Rodrigues</div><div class="titulo">${esc(o.titulo)}</div>${o.subtitulo ? `<div class="subtitulo">${esc(o.subtitulo)}</div>` : ''}</div>
    <div class="meta">Impresso em: ${agora.toLocaleDateString('pt-BR')}<br/>Às: ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  ${o.info.length ? `<div class="info">${o.info.map((i) => `<div><b>${esc(i.label)}</b><span>${esc(i.value)}</span></div>`).join('')}</div>` : ''}
  ${o.corpo}
  <div class="rodape"><span>Portal do Professor JBR — Escola José Barbosa Rodrigues</span><span>Documento gerado automaticamente pelo sistema</span></div>
  <script>window.onload = function () { window.print(); setTimeout(function () { window.close(); }, 500); };</script>
</body></html>`;
  const win = window.open('', '_blank', 'width=1100,height=750');
  if (!win) {
    alert('Permita pop-ups para este site para poder imprimir.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
