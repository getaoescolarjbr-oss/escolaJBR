// A janela de impressão é um documento novo: nada do CSS do app entra nela — nem
// Tailwind, nem o katex.min.css importado no main.tsx. Por isso tudo que precisa
// aparecer no papel tem que estar no <style> daqui. O ?inline traz o CSS do
// KaTeX como string pro bundle; sem ele as fórmulas [[EQ:]] saem embaralhadas.
import katexCss from 'katex/dist/katex.min.css?inline';
import type { Question } from '../types/bancoQuestoes';
import { ehQuestaoEscrita } from '../types/bancoQuestoes';

// Só questão objetiva entra no cartão resposta — dissertativa e redação são
// escritas na própria folha, nas linhas pautadas.
export function entraNoCartaoResposta(q: Question) {
  return !ehQuestaoEscrita(q.tipo) && q.alternatives.length > 0;
}

/**
 * Cabecalho da prova, identificacao do aluno, instrucoes e o cartao-resposta simples
 * (aquele de bolhas com letra impressa, sem leitura optica — o cartao OMR tem CSS
 * proprio em utils/cartaoResposta.ts).
 *
 * Vivia so dentro do <style> da janela de impressao, e o preco apareceu na tela: um
 * preview que monta este mesmo HTML fora da janela renderizava sem regra nenhuma, e a
 * logo da escola saia em tamanho natural, ocupando a tela inteira. Exportado, o preview
 * e o papel passam a ler a mesma fonte.
 *
 * So entram regras presas a uma classe. As de `*` e `body` continuam na janela de
 * impressao: aplicadas dentro do app, zerariam a margem de tudo e poriam uma borda azul
 * em volta da pagina inteira.
 */
export const PROVA_LAYOUT_CSS = `
.prova-header {
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
  gap: 12px;
  border-bottom: 3px solid #002677;
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.prova-logo { height: 100%; width: auto; max-width: 110px; object-fit: contain; flex-shrink: 0; }

.prova-header-info { flex: 1; min-width: 0; }

.prova-escola { font-size: 1.15em; font-weight: 900; color: #002677; text-transform: uppercase; letter-spacing: -0.2px; }

.prova-titulo { font-size: 1.35em; font-weight: 900; color: #1a1a2e; margin-top: 2px; }

.prova-meta { font-size: 0.85em; color: #666; font-weight: 600; margin-top: 2px; }

.prova-aluno {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  font-size: 0.95em;
  font-weight: 600;
  border: 1px solid #c7d7f7;
  background: #f0f4ff;
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 10px;
}

.prova-instrucoes {
  font-size: 0.85em;
  color: #444;
  background: #fafafa;
  border: 1px solid #e2e2e2;
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 10px;
  white-space: pre-wrap;
}

.cartao-resposta {
  border: 1.5px solid #002677;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  break-inside: avoid;
}

.cartao-titulo {
  font-size: 0.95em;
  font-weight: 900;
  color: #002677;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 6px;
}

.cartao-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px 10px;
}

.cartao-item { display: flex; align-items: center; gap: 4px; font-size: 0.81em; }

.cartao-num { font-weight: 900; width: 14px; flex-shrink: 0; }

.cartao-bolhas { display: flex; gap: 3px; }

.bolha {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15em;
  height: 1.15em;
  border: 1.1px solid #002677;
  border-radius: 50%;
  font-size: 0.62em;
  font-weight: 700;
  color: #002677;
  flex-shrink: 0;
}
`;

// Regras que precisam valer IGUAIS no preview da tela e no papel. Ficam aqui pra
// os modais de prova importarem — quando estavam copiadas em cada modal, o CSS
// de impressão evoluiu sozinho e as figuras saíram estourando a margem.
export const PROVA_QUESTOES_CSS = `
  .questoes-coluna.duas-colunas { column-count: 2; column-gap: 18px; column-rule: 1px solid #999; }

  .questao {
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px dashed #ddd;
    /* Permitimos que a questão quebre entre colunas para evitar grandes espaços
       vazios. Apenas o cabeçalho (enunciado) fica vinculado às alternativas via
       break-after no próprio .questao-enunciado. */
    break-inside: auto;
    page-break-inside: auto;
  }
  /* Impede que o enunciado fique sozinho no fim de uma coluna, separado das
     alternativas que continuam na próxima. */
  .questao-enunciado { margin: 3px 0 5px; line-height: 1.35; text-align: justify; break-after: avoid; page-break-after: avoid; }
  .questao-num { font-weight: 900; color: #002677; }

  /* Texto-base compartilhado entre questões (support_texts). Filete à esquerda e
     recuo para o aluno distinguir de relance o que é o texto e o que é o comando
     da questão — na tela o texto fica recolhido atrás de um botão, no papel não
     há como recolher. */
  .texto-apoio {
    margin: 2px 0 6px;
    padding: 3px 0 3px 8px;
    border-left: 2px solid #002677;
    line-height: 1.3;
    text-align: justify;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .questao-img { max-width: 100%; margin: 4px 0; }

  /* Linhas pautadas das questões dissertativas/redação, no lugar das alternativas.
     São border-bottom — regra de verdade, não background: o navegador imprime
     bordas mesmo com "gráficos de fundo" desligado, que é o padrão de muitos, e um
     div com background-color sairia em branco no papel. */
  .linhas-resposta { margin: 5px 0 2px; }
  .linha-resposta { height: 7mm; border-bottom: 1px solid #555; }

  /* Uma redação (30 linhas ≈ 21cm) não cabe numa coluna: nesse caso a questão
     ocupa a largura inteira e pode continuar na página seguinte — mas o enunciado
     nunca se separa do início das linhas. */
  .questao.questao-longa {
    break-inside: auto;
    page-break-inside: auto;
    column-span: all;
  }
  .questao.questao-longa .questao-enunciado { break-after: avoid; page-break-after: avoid; }

  /* Rede de segurança: qualquer imagem fica presa na largura da coluna. As
     figuras vindas de [[IMG:]] só têm classe Tailwind, que não existe na janela
     de impressão — sem esta regra saem no tamanho natural (ex.: 757x1107 px) e
     passam por cima do texto. */
  img { max-width: 100%; height: auto; }

  .qm-img-group { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 8px; margin: 4px 0; }

  /* Teto em mm: em duas colunas cada coluna tem ~90mm. Imagens no enunciado podem
     ser um pouco maiores; imagens dentro de alternativas (.alternativa .qm-img) devem
     ser bem compactas para não ocupar espaço desnecessário no papel.
     No papel o limitador REAL é a largura da coluna (~90mm em duas colunas), e o
     max-width: 100% já cuida disso. O teto de altura serve só para uma figura
     muito alta não ocupar a página inteira; apertá-lo demais encolhia a figura
     abaixo do tamanho natural e tornava o gráfico ilegível. */
  .qm-img { max-width: 100%; max-height: 78mm; width: auto; height: auto; object-fit: contain; }
  .questoes-coluna:not(.duas-colunas) .qm-img { max-height: 114mm; }

  /* Imagens dentro de alternativas. Em duas colunas (~90mm) o teto é 48mm; em
     coluna única, 64mm. */
  .alternativa .qm-img,
  .alternativa img {
    max-height: 30mm !important;
    max-width: 65mm !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
    display: inline-block !important;
    margin: 2px 0 !important;
  }
  .questoes-coluna:not(.duas-colunas) .alternativa .qm-img,
  .questoes-coluna:not(.duas-colunas) .alternativa img {
    max-height: 40mm !important;
    max-width: 80mm !important;
  }

  .qm-ref { text-align: right; font-size: 0.8em; font-style: italic; color: #666; margin-top: 2px; }
  .qm-table-wrap { overflow-x: auto; }
  .qm-table { border-collapse: collapse; width: auto; margin: 4px 0; font-size: 0.9em; }
  .qm-table td { border: 1px solid #999; padding: 3px 8px; }

  /* Deixar quebrar linha no meio da fórmula desmonta a renderização do KaTeX. */
  .katex-inline { white-space: nowrap; }

  .prova-nota-box { display: flex; flex-direction: column; width: 74px; min-width: 74px; flex-shrink: 0; border: 1.5px solid #002677; border-radius: 6px; overflow: hidden; }
  .prova-nota-label { font-size: 0.72em; font-weight: 900; color: #002677; text-align: center; text-transform: uppercase; letter-spacing: 0.4px; padding: 3px 0; border-bottom: 1.5px solid #002677; background: #f0f4ff; }
  .alternativas-linha { display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .alternativas-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; row-gap: 6px; align-items: start; }
  .alternativas-coluna { display: flex; flex-direction: column; gap: 3px; }
  .alternativa { display: flex; gap: 5px; align-items: flex-start; min-width: 0; }
  .alternativa b { flex-shrink: 0; line-height: 1.25; }
  .alternativa-texto { flex: 1; min-width: 0; text-align: justify; }
  .alternativas-grid-2 .alternativa-texto { text-align: left; }
`;

/**
 * `cssExtra` entra depois das regras padrão. Existe para a impressão em lote por aluno
 * (ImprimirFolhasModal) trazer o CSS do cartão-resposta em milímetros sem que as demais
 * telas de impressão carreguem essas regras.
 */
export function printProva(ref: HTMLElement | null, tituloDocumento: string, cssExtra = '') {
  if (!ref) return;

  const clone = ref.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, [class*="no-print"]').forEach((el) => el.remove());

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${tituloDocumento}</title>
  <!-- A janela abre como about:blank; sem <base> o /assets/KaTeX_*.woff2 que o
       CSS abaixo referencia pode não resolver, dependendo do navegador, e as
       fórmulas caem numa fonte de fallback. -->
  <base href="${window.location.origin}/" />
  <style>${katexCss}</style>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #1a1a2e;
      background: #fff;
      padding: 8px;
      border: 1.5px solid #002677;
    }

    ${PROVA_LAYOUT_CSS}

    ${PROVA_QUESTOES_CSS}

    ${cssExtra}

    .no-print, [class*="no-print"] { display: none !important; }

    @media print {
      body { padding: 4mm; }
      @page { margin: 6mm 5mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  ${clone.innerHTML}
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=700');
  if (!win) {
    alert('Permita pop-ups para este site para poder imprimir.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
