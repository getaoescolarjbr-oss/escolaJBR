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
  .questao-img {
    max-width: 100%;
    max-height: 65mm;
    width: auto !important;
    height: auto !important;
    object-fit: contain;
    margin: 4px auto;
    display: block;
  }
  .questoes-coluna:not(.duas-colunas) .questao-img { max-height: 95mm; }

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

  /* Teto em mm: em duas colunas cada coluna tem ~90mm, então 65mm mantém a figura legível sem
     empurrar as alternativas pra página seguinte. Imagens no enunciado ficam contidas;
     imagens dentro de alternativas (.alternativa .qm-img) devem ser bem compactas
     para não ocupar espaço desnecessário no papel. */
  .qm-img {
    max-width: 100%;
    max-height: 65mm;
    width: auto !important;
    height: auto !important;
    object-fit: contain;
  }
  .questoes-coluna:not(.duas-colunas) .qm-img { max-height: 95mm; }

  /* Imagens dentro de alternativas. Em duas colunas (~90mm) o teto é 30mm; em
     coluna única, 40mm. */
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

    /* Largura fixa em mm igual à área útil real da página impressa (A4 = 210mm,
       menos as margens de 5mm de cada lado do @page abaixo = 200mm). Sem isto, a
       janela mede o texto/colunas na largura da JANELA (aberta com 1000px, bem mais
       larga que o papel) — o texto quebra linha em pontos diferentes do que vai
       quebrar no papel, e a contagem de páginas do script abaixo (que decide se
       entra folha de rascunho) sai errada, mesmo em prova de uma coluna. Medir na
       MESMA largura do papel é o que faz a estimativa bater com o impresso de
       verdade. */
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #1a1a2e;
      background: #fff;
      width: 200mm;
      max-width: 200mm;
      margin: 0 auto;
      padding: 4mm;
      border: 1.5px solid #002677;
    }

    ${PROVA_LAYOUT_CSS}

    ${PROVA_QUESTOES_CSS}

    ${cssExtra}

    .no-print, [class*="no-print"] { display: none !important; }

    @media print {
      @page { margin: 6mm 5mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  ${clone.innerHTML}
  <script>
    window.onload = function() {
      // As fontes do KaTeX (woff2) carregam de forma assíncrona — onload não espera
      // elas terminarem. Medir a altura do conteúdo ANTES delas carregarem usa a
      // fonte de fallback (métricas diferentes: linha mais baixa/alta), o que
      // subestima ou sobrestima quantas páginas o conteúdo realmente ocupa —
      // exatamente o que causava a folha de rascunho saindo no lugar errado em
      // prova com fórmula/notação química. document.fonts.ready garante que toda
      // fonte referenciada no CSS já carregou antes de medir.
      var ajustarEImprimir = function() {
      try {
        var ruler = document.createElement('div');
        // 297mm (A4) - 6mm de margem de cima - 6mm de baixo (@page abaixo) = 285mm de
        // área útil vertical real por página impressa.
        ruler.style.height = '285mm';
        ruler.style.position = 'absolute';
        ruler.style.visibility = 'hidden';
        document.body.appendChild(ruler);
        var a4Height = ruler.offsetHeight || 1047;
        document.body.removeChild(ruler);

        // Divide o conteúdo de um aluno em páginas EXPLÍCITAS, medindo cada questão
        // (elemento real, já carregado) e encaixando uma a uma — em vez de estimar o
        // total via altura-total ÷ altura-da-página, que sistematicamente ficava
        // errado (chegou a errar quase uma página inteira num caso real medido).
        // Assim o número de páginas deixa de ser um palpite e passa a ser exatamente
        // o tanto de blocos que este código monta.
        function paginarConteudoExplicitamente(bloco, a4Height) {
          var conteudo = bloco.querySelector('.pagina-conteudo');
          if (!conteudo) return null;
          var questoesColuna = conteudo.querySelector('.questoes-coluna');
          if (!questoesColuna || questoesColuna.children.length === 0) return conteudo;

          var numColunas = questoesColuna.classList.contains('duas-colunas') ? 2 : 1;
          // Margem de segurança: encaixa um pouco antes do limite real da página, pra
          // sobrar folga (troco de arredondamento, colapso de margem) e nunca estourar
          // pra página seguinte por um pixel.
          var capacidadeColuna = a4Height * 0.96;

          var headerEls = [];
          var headerH = 0;
          var child = conteudo.firstElementChild;
          while (child && child !== questoesColuna) {
            headerEls.push(child);
            headerH += child.offsetHeight;
            child = child.nextElementSibling;
          }

          var footerEls = [];
          var footerH = 0;
          child = questoesColuna.nextElementSibling;
          while (child) {
            footerEls.push(child);
            footerH += child.offsetHeight;
            child = child.nextElementSibling;
          }

          // Encaixa cada .questao INTEIRA (sem dividir enunciado/alternativas — essa
          // divisão já causou mais de um bug e voltou pra versão simples, comprovada
          // certa nos 27 alunos reais desta prova). Mede sempre com o elemento ainda
          // anexado no documento (offsetHeight de elemento fora da árvore dá 0).
          var questoes = Array.prototype.slice.call(questoesColuna.children);
          var paginasChunks = [[]];
          var coluna = 1;
          var usado = headerH;
          for (var qi = 0; qi < questoes.length; qi++) {
            var h = questoes[qi].offsetHeight;
            if (usado > 0 && usado + h > capacidadeColuna) {
              if (coluna < numColunas) {
                coluna++;
              } else {
                coluna = 1;
                paginasChunks.push([]);
              }
              usado = 0;
            }
            usado += h;
            paginasChunks[paginasChunks.length - 1].push(questoes[qi]);
          }
          // O rodapé (cartão no fim, largura cheia) fica fora do layout de colunas —
          // deixa fluir pro final da última página como sempre foi: se não couber de
          // verdade, o próprio break-inside:avoid do cartão empurra pra a próxima.

          if (paginasChunks.length <= 1) return conteudo; // cabe numa página só, nada a fazer

          var novosBlocos = [];
          for (var pi = 0; pi < paginasChunks.length; pi++) {
            var novaPagina = document.createElement('div');
            novaPagina.className = 'pagina pagina-conteudo';
            if (pi === 0) {
              headerEls.forEach(function(h) { novaPagina.appendChild(h); });
            }
            if (paginasChunks[pi].length > 0) {
              var novaColuna = document.createElement('div');
              novaColuna.className = questoesColuna.className;
              paginasChunks[pi].forEach(function(q) { novaColuna.appendChild(q); });
              novaPagina.appendChild(novaColuna);
            }
            if (pi === paginasChunks.length - 1) {
              footerEls.forEach(function(f) { novaPagina.appendChild(f); });
            }
            novosBlocos.push(novaPagina);
          }

          var refNode = conteudo.nextSibling;
          conteudo.remove();
          novosBlocos.forEach(function(nb) { bloco.insertBefore(nb, refNode); });
          return novosBlocos[novosBlocos.length - 1];
        }

        var blocos = document.querySelectorAll('.bloco-aluno');
        blocos.forEach(function(bloco) {
          var ultimaPaginaConteudo = paginarConteudoExplicitamente(bloco, a4Height);
          if (!ultimaPaginaConteudo) return;

          var rascunho = bloco.querySelector('.pagina-rascunho');
          var emBranco = bloco.querySelector('.pagina-em-branco');
          var cartao = bloco.querySelector('.pagina-cartao');

          // Agora é contagem exata: quantos .pagina-conteudo este aluno tem de fato,
          // não mais uma estimativa por altura.
          var paginasConteudo = bloco.querySelectorAll('.pagina-conteudo').length;
          if (cartao) paginasConteudo += 1;

          var modo = bloco.getAttribute('data-separador');

          // Log temporário de diagnóstico — abra o DevTools (F12) antes de gerar o PDF
          // pra ver, por aluno, quantas páginas reais o script montou.
          console.log('[print-diag]', bloco.getAttribute('data-aluno'), {
            aluno: (bloco.querySelector('.prova-aluno strong') || {}).textContent,
            paginasConteudo: paginasConteudo,
            temCartaoProprio: !!cartao,
            temRascunhoNoDom: !!rascunho
          });

          if (modo === 'RASCUNHO_VERSO' || modo === 'PAGINA_BRANCA') {
            // Se as páginas já forem pares (ex: 2 páginas):
            // Remove o separador extra para não deixar o total ímpar (3 páginas),
            // evitando que o próximo aluno comece ao lado do rascunho na mesma folha.
            if (paginasConteudo % 2 === 0) {
              if (rascunho) rascunho.remove();
              if (emBranco) emBranco.remove();

              // Já dá página par sem rascunho nenhum — sobra espaço em branco no
              // final da última página à toa. Em vez de deixar em branco, tenta
              // escrever "Espaço para Rascunho" ALI MESMO (dentro do fluxo normal do
              // conteúdo, sem forçar página nova): se couber na sobra, não gasta
              // papel extra nenhum. Só faz isso se NÃO mudar a contagem de páginas —
              // se o texto do rascunho empurrar o conteúdo pra uma página a mais,
              // desfaz na hora (senão o total vira ímpar de novo e o próximo aluno
              // volta a colar na mesma folha física deste).
              if (modo === 'RASCUNHO_VERSO') {
                var questoesColuna = ultimaPaginaConteudo.querySelector('.questoes-coluna') || ultimaPaginaConteudo;
                var inline = document.createElement('div');
                inline.className = 'rascunho-inline';
                inline.style.cssText =
                  'column-span: all; break-inside: avoid; page-break-inside: avoid; ' +
                  'margin-top: 6mm; padding: 4mm 6mm; border: 1.5px dashed #a0aec0; ' +
                  'border-radius: 8px; min-height: 45mm;';
                inline.innerHTML =
                  '<span style="display:block; text-align:center; font-size:10.5pt; ' +
                  'font-weight:800; color:#002677; text-transform:uppercase; ' +
                  'letter-spacing:0.6px; border-bottom:1px solid #e2e8f0; ' +
                  'padding-bottom:2mm; margin-bottom:3mm;">Espaço para Rascunho / Cálculos</span>';
                questoesColuna.appendChild(inline);

                // Checagem direta: só essa ÚLTIMA página ficou mais alta que a área
                // útil real? Isso substitui o cálculo por estimativa de antes — agora
                // é uma altura só, comparada com o limite real, sem margem de erro
                // acumulada de todo o documento.
                if (ultimaPaginaConteudo.scrollHeight > a4Height) {
                  // Não coube sem empurrar pra outra página — desfaz e deixa a
                  // sobra em branco mesmo, pra não comprometer o alinhamento.
                  inline.remove();
                }
              }
            } else if (!rascunho && !emBranco) {
              // Caso que faltava: a estimativa ANTES de renderizar (baseada em
              // contagem de caracteres, sem saber de fórmula/notação complexa) achou
              // que ia dar página par e não colocou rascunho nenhum no HTML — mas a
              // altura real, medida agora, é ímpar. Sem inserir a folha aqui, o total
              // deste aluno fica ímpar e o próximo aluno começa colado na mesma folha
              // física (era exatamente esse o bug: só existia lógica pra REMOVER um
              // rascunho sobrando, nunca pra ADICIONAR um que faltava).
              var extra = document.createElement('div');
              extra.className = 'pagina ' + (modo === 'PAGINA_BRANCA' ? 'pagina-em-branco' : 'pagina-rascunho');
              extra.style.minHeight = '260mm';
              if (modo === 'RASCUNHO_VERSO') {
                extra.innerHTML =
                  '<div class="pagina-rascunho-box">' +
                    '<div class="pagina-rascunho-header">' +
                      '<span class="pagina-rascunho-titulo">Espaço para Rascunho / Cálculos</span>' +
                    '</div>' +
                  '</div>';
              }
              bloco.appendChild(extra);
            }
          } else if (modo === 'SEMPRE_RASCUNHO') {
            // Se o usuário quer sempre rascunho mesmo com páginas pares:
            // adiciona página em branco para manter o total de páginas PAR (4 páginas).
            if (paginasConteudo % 2 === 0 && rascunho && !emBranco) {
              var blank = document.createElement('div');
              blank.className = 'pagina pagina-em-branco';
              blank.style.minHeight = '260mm';
              bloco.appendChild(blank);
            }
          }
        });
      } catch (err) {
        console.error('Erro no ajuste de páginas:', err);
      }

      window.print();
      setTimeout(function() { window.close(); }, 500);
      };

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(ajustarEImprimir, ajustarEImprimir);
      } else {
        ajustarEImprimir();
      }
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
