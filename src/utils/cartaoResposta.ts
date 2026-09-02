// ====================================================================================
// GEOMETRIA DO CARTÃO-RESPOSTA
//
// Este arquivo é a fonte única da posição de cada bolha no papel. A folha impressa
// (ImprimirFolhasModal) e o leitor de câmera (lib/omr.ts) leem daqui — se cada um
// tivesse sua própria noção de onde fica a bolha da linha 7, bastaria mudar um padding
// de um lado para a correção passar a ler a resposta errada sem nenhum erro aparente.
//
// Tudo em MILÍMETROS, com a origem no CENTRO DA MARCA DE REFERÊNCIA superior esquerda.
// Milímetro é a unidade certa aqui porque é a que o navegador honra na impressão
// (`@page` + `mm`) e a que o leitor reconstrói a partir das quatro marcas.
//
// A folha tem quatro marcas quadradas sólidas nos cantos da área de bolhas. O leitor
// acha essas quatro marcas, calcula a homografia da foto para o papel e só então
// procura as bolhas — é isso que faz a leitura funcionar com o celular inclinado, a
// folha torta na mesa e a página levemente curvada.
// ====================================================================================

/**
 * Lado da marca de referência quadrada.
 *
 * 7mm, e não 5 ou 6, para a marca ter área bem maior que a de uma bolha preenchida
 * (49mm² contra 19,6mm²). O leitor separa uma da outra justamente por área, e uma
 * margem folgada aqui é o que impede uma bolha marcada perto do canto de se passar por
 * marca de referência.
 */
export const MARCA_MM = 7;

/** Diâmetro da bolha impressa. */
export const BOLHA_MM = 5;

/** Distância entre centros de bolhas vizinhas, na horizontal. */
export const PASSO_BOLHA_MM = 7.5;

/** Distância entre centros de linhas vizinhas. */
export const PASSO_LINHA_MM = 8;

/** Espaço reservado à esquerda de cada bloco para o número da questão. */
export const ROTULO_MM = 11;

/** Folga entre o retângulo das marcas e a primeira/última bolha. */
export const MARGEM_INTERNA_MM = 9;

/** Espaço horizontal entre blocos de colunas. */
export const ENTRE_BLOCOS_MM = 6;

/** Máximo de alternativas que uma questão pode ter (A..E). */
export const MAX_ALTERNATIVAS = 5;

/**
 * Quantas linhas cada bloco tenta ter antes de o cartão abrir mais uma coluna.
 *
 * O número existe para manter o cartão com proporção de retângulo, não de tira. Uma
 * coluna única de 20 linhas dá uma área de 66x178mm: some espaço na A4, é chata de ler
 * e — o que importa mais aqui — obriga a câmera a enquadrar um retângulo muito alongado,
 * em que as marcas dos cantos ficam pequenas em relação ao quadro e a leitura piora.
 */
export const LINHAS_ALVO_POR_BLOCO = 12;

/**
 * Teto de blocos lado a lado. Quatro não cabem: 4 x 48,5mm + 3 x 6mm de intervalo dá
 * 230mm, contra os ~190mm úteis de uma A4 retrato.
 */
export const MAX_BLOCOS = 3;

export interface BolhaGeom {
  /** 1-based, na ordem do cartão. Casa com `linha` de rpc_gabarito_versao. */
  linha: number;
  /** 0-based: 0 = bolha "A". */
  indice: number;
  letra: string;
  /** Centro da bolha, em mm, a partir da marca superior esquerda. */
  x: number;
  y: number;
}

export interface LinhaGeom {
  linha: number;
  /** Número que sai impresso — é o número da questão na prova, não o da linha. */
  numeroNaProva: number;
  qtdAlternativas: number;
  /** Onde imprimir o rótulo (canto superior esquerdo do texto). */
  rotuloX: number;
  rotuloY: number;
  bolhas: BolhaGeom[];
}

export interface CartaoGeom {
  /** Distância horizontal entre os centros das marcas. */
  larguraMm: number;
  /** Distância vertical entre os centros das marcas. */
  alturaMm: number;
  blocos: number;
  linhasPorBloco: number;
  linhas: LinhaGeom[];
  /** Centros das quatro marcas, na ordem TL, TR, BR, BL. */
  marcas: { x: number; y: number }[];
}

export const LETRAS_BOLHA = ['A', 'B', 'C', 'D', 'E'] as const;

/** Uma linha do cartão, do ponto de vista de quem monta a folha. */
export interface ItemCartao {
  numeroNaProva: number;
  qtdAlternativas: number;
}

/**
 * Monta a geometria do cartão para uma lista de questões objetivas já na ordem da
 * versão. O leitor chama isto com a mesma lista (vinda de rpc_gabarito_versao) para
 * saber onde procurar cada bolha.
 */
export function calcularGeometria(itens: ItemCartao[]): CartaoGeom {
  const total = itens.length;
  const blocos = Math.max(1, Math.min(MAX_BLOCOS, Math.ceil(total / LINHAS_ALVO_POR_BLOCO)));
  const linhasPorBloco = Math.ceil(total / blocos);

  const larguraBloco = ROTULO_MM + MAX_ALTERNATIVAS * PASSO_BOLHA_MM;
  const gradeLargura = blocos * larguraBloco + (blocos - 1) * ENTRE_BLOCOS_MM;
  const gradeAltura = Math.max(1, linhasPorBloco) * PASSO_LINHA_MM;

  const larguraMm = gradeLargura + 2 * MARGEM_INTERNA_MM;
  const alturaMm = gradeAltura + 2 * MARGEM_INTERNA_MM;

  const linhas: LinhaGeom[] = itens.map((item, i) => {
    const bloco = Math.floor(i / linhasPorBloco);
    const linhaNoBloco = i % linhasPorBloco;

    const baseX = MARGEM_INTERNA_MM + bloco * (larguraBloco + ENTRE_BLOCOS_MM);
    // +metade do passo para o centro da bolha cair no meio da faixa da linha.
    const centroY = MARGEM_INTERNA_MM + linhaNoBloco * PASSO_LINHA_MM + PASSO_LINHA_MM / 2;

    const qtd = Math.max(0, Math.min(MAX_ALTERNATIVAS, item.qtdAlternativas));
    const bolhas: BolhaGeom[] = Array.from({ length: qtd }, (_, idx) => ({
      linha: i + 1,
      indice: idx,
      letra: LETRAS_BOLHA[idx],
      x: baseX + ROTULO_MM + idx * PASSO_BOLHA_MM + PASSO_BOLHA_MM / 2,
      y: centroY,
    }));

    return {
      linha: i + 1,
      numeroNaProva: item.numeroNaProva,
      qtdAlternativas: qtd,
      rotuloX: baseX,
      rotuloY: centroY,
      bolhas,
    };
  });

  return {
    larguraMm,
    alturaMm,
    blocos,
    linhasPorBloco,
    linhas,
    marcas: [
      { x: 0, y: 0 },
      { x: larguraMm, y: 0 },
      { x: larguraMm, y: alturaMm },
      { x: 0, y: alturaMm },
    ],
  };
}

/**
 * CSS do cartão. Vive aqui, e não em printProva.ts, porque a janela de impressão é um
 * documento novo sem nenhum CSS do app (ver o comentário no topo de printProva.ts) e
 * porque o preview na tela precisa do mesmo bloco para mostrar exatamente o que sai no
 * papel.
 *
 * Todas as medidas em mm de propósito: é o que sobrevive à impressão. Em px, a mesma
 * folha sai com tamanhos diferentes conforme o DPI escolhido no diálogo de impressão, e
 * aí a homografia do leitor deixa de bater.
 */
export const CARTAO_CSS = `
  .cartao-omr {
    position: relative;
    /* Sem isto o Chrome descarta os quadrados pretos das marcas quando o usuário
       imprime com "Gráficos de fundo" desligado, que é o padrão — e sem marca não há
       leitura nenhuma. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .cartao-omr-marca {
    position: absolute;
    background: #000;
    /* As marcas são posicionadas pelo CENTRO; a translação tira o canto do caminho. */
    transform: translate(-50%, -50%);
  }

  .cartao-omr-bolha {
    position: absolute;
    border: 0.4mm solid #000;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    color: #444;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .cartao-omr-rotulo {
    position: absolute;
    transform: translateY(-50%);
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    color: #000;
    white-space: nowrap;
  }

  .cartao-omr-cabecalho {
    display: flex;
    align-items: flex-start;
    gap: 4mm;
    margin-bottom: 3mm;
    break-inside: avoid;
  }

  .cartao-omr-qr { width: 26mm; height: 26mm; flex-shrink: 0; }

  .cartao-omr-dados { flex: 1; min-width: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.45; }
  .cartao-omr-dados .nome { font-size: 12pt; font-weight: 900; text-transform: uppercase; }
  .cartao-omr-dados .linha-dados { color: #333; }
  .cartao-omr-versao {
    flex-shrink: 0;
    border: 0.6mm solid #000;
    border-radius: 2mm;
    padding: 2mm 4mm;
    text-align: center;
    font-family: Arial, Helvetica, sans-serif;
  }
  .cartao-omr-versao .rot { font-size: 20pt; font-weight: 900; line-height: 1; }
  .cartao-omr-versao .cap { font-size: 7pt; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }

  .cartao-omr-aviso {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
    color: #333;
    border: 0.3mm solid #888;
    border-radius: 1.5mm;
    padding: 1.5mm 3mm;
    margin-bottom: 3mm;
  }
`;
