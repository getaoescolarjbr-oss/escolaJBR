// ====================================================================================
// LEITURA ÓPTICA DO CARTÃO-RESPOSTA (OMR), 100% no navegador do celular
//
// O caminho de uma foto até "o aluno marcou C na linha 7":
//
//   1. Binariza o quadro com limiar ADAPTATIVO (não global). Foto de sala de aula tem
//      sombra da própria mão em metade da folha; um limiar único transforma a metade
//      sombreada inteira em "preto" e a leitura vira lixo.
//   2. Acha componentes conexos escuros e seleciona os quatro que parecem as marcas de
//      referência: quadrados sólidos, de tamanho parecido, nos extremos.
//   3. Calcula a homografia papel -> foto a partir dessas quatro marcas. É esse passo
//      que absorve o celular inclinado e a folha torta: depois dele, "onde fica a bolha
//      da linha 7" é uma pergunta respondida em milímetros, não em pixels.
//   4. Amostra o miolo de cada bolha e decide preenchida/vazia COMPARANDO AS BOLHAS DA
//      MESMA LINHA. Comparação relativa em vez de limiar fixo é o que faz funcionar
//      tanto o aluno que pinta forte de caneta quanto o que passa um lápis fraco.
//
// Nada disto sai do aparelho: a rede só vê o código do QR e as letras lidas.
// ====================================================================================

import jsQR from 'jsqr';
import type { CartaoGeom } from '../utils/cartaoResposta';
import { BOLHA_MM } from '../utils/cartaoResposta';

export interface Ponto {
  x: number;
  y: number;
}

export interface LeituraCartao {
  /** Uma entrada por linha: 'A'..'E', '' (em branco) ou '*' (marcação dupla). */
  marcacoes: string[];
  /** 0..1 — a menor separação entre a bolha escolhida e a concorrente, entre as linhas. */
  confianca: number;
  /** Linhas cuja decisão ficou apertada. 1-based, para casar com o cartão. */
  linhasDuvidosas: number[];
  /** As quatro marcas encontradas, para desenhar o contorno na tela. */
  marcas: Ponto[];
}

/** Abaixo disto a bolha é considerada em branco, por mais que seja a mais escura da linha. */
const LIMIAR_MARCADA = 0.3;

/** Concorrente acima desta fração da escolhida = o aluno marcou duas. */
const FRACAO_DUPLA = 0.72;

/** Separação abaixo da qual a linha entra em `linhasDuvidosas` para conferência humana. */
const SEPARACAO_MINIMA = 0.12;

/**
 * Quanto a proporção do quadrilátero detectado pode divergir da proporção conhecida do
 * cartão, em log — 0,35 é um fator de ~1,42 para mais ou para menos. Cobre com folga a
 * deformação de uma foto inclinada e ainda descarta um quadrilátero formado por marcas
 * erradas.
 */
const TOLERANCIA_ASPECTO = 0.35;

// ------------------------------------------------------------------------------------
// Pré-processamento
// ------------------------------------------------------------------------------------

function paraCinza(img: ImageData): Uint8ClampedArray {
  const { data, width, height } = img;
  const cinza = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Pesos de luminância: o vermelho da caneta esferográfica azul-escura some num
    // (r+g+b)/3 ingênuo e a marcação deixa de ser detectada.
    cinza[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return cinza;
}

/**
 * Limiar adaptativo de Bradley: compara cada pixel com a média da vizinhança, calculada
 * em O(1) por pixel via imagem integral. Devolve 1 para pixel escuro (tinta).
 */
function binarizar(cinza: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let soma = 0;
    for (let x = 0; x < width; x++) {
      soma += cinza[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + soma;
    }
  }

  const raio = Math.max(4, Math.floor(width / 16));
  const fator = 0.86;
  const bin = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - raio);
    const y1 = Math.min(height - 1, y + raio);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - raio);
      const x1 = Math.min(width - 1, x + raio);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const soma =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integral[y0 * (width + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];
      bin[y * width + x] = cinza[y * width + x] * area < soma * fator ? 1 : 0;
    }
  }
  return bin;
}

interface Componente {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  somaX: number;
  somaY: number;
}

/** Componentes conexos (4-vizinhança) dos pixels escuros, por varredura em fila. */
function componentes(bin: Uint8Array, width: number, height: number): Componente[] {
  const visitado = new Uint8Array(width * height);
  const lista: Componente[] = [];
  const fila = new Int32Array(width * height);

  for (let inicio = 0; inicio < bin.length; inicio++) {
    if (bin[inicio] === 0 || visitado[inicio]) continue;

    let cabeca = 0;
    let cauda = 0;
    fila[cauda++] = inicio;
    visitado[inicio] = 1;

    const c: Componente = {
      minX: width, minY: height, maxX: 0, maxY: 0, area: 0, somaX: 0, somaY: 0,
    };

    while (cabeca < cauda) {
      const p = fila[cabeca++];
      const x = p % width;
      const y = (p / width) | 0;

      c.area++;
      c.somaX += x;
      c.somaY += y;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;

      if (x > 0 && bin[p - 1] && !visitado[p - 1]) { visitado[p - 1] = 1; fila[cauda++] = p - 1; }
      if (x < width - 1 && bin[p + 1] && !visitado[p + 1]) { visitado[p + 1] = 1; fila[cauda++] = p + 1; }
      if (y > 0 && bin[p - width] && !visitado[p - width]) { visitado[p - width] = 1; fila[cauda++] = p - width; }
      if (y < height - 1 && bin[p + width] && !visitado[p + width]) { visitado[p + width] = 1; fila[cauda++] = p + width; }
    }

    lista.push(c);
  }
  return lista;
}

/**
 * Escolhe as quatro marcas de referência entre os componentes escuros.
 *
 * Os três olhos do QR Code também são quadrados escuros e são a armadilha óbvia aqui.
 * Duas coisas os eliminam: o anel externo do olho é oco (preenchimento ~0,49 do seu
 * retângulo, contra ~0,95 de uma marca sólida) e o quadradinho central é pequeno demais
 * para sobreviver ao corte por área relativa.
 *
 * MUDANÇA IMPORTANTE: o algoritmo anterior pegava os 4 extremos absolutos da imagem,
 * o que falha quando a câmera enquadra toda a folha A4 com questões em 2 colunas:
 * logo, caixa de nota e números de questão também geram componentes sólidos e ocupam
 * os extremos, fazendo o algoritmo eleger cantos do cabeçalho em vez das 4 marcas.
 *
 * Agora testamos combinações de candidatos, priorizando os mais próximos do QR Code
 * (que já foi localizado com precisão) e escolhendo o quarteto que minimiza o erro
 * de aspecto em relação à geometria conhecida do cartão.
 */
function acharMarcas(
  comps: Componente[],
  width: number,
  height: number,
  aspectoAlvo: number,
  ancoraQr?: Ponto | null
): Ponto[] | null {
  const areaImagem = width * height;

  const candidatos = comps.filter((c) => {
    const larg = c.maxX - c.minX + 1;
    const alt = c.maxY - c.minY + 1;
    if (larg < 4 || alt < 4) return false;

    const proporcao = larg / alt;
    if (proporcao < 0.5 || proporcao > 2) return false;

    if (c.area / (larg * alt) < 0.55) return false;

    const rel = c.area / areaImagem;
    return rel > 0.00007 && rel < 0.02;
  });

  if (candidatos.length < 4) return null;

  // As quatro marcas são do mesmo tamanho impresso. Uma bolha preenchida também é um
  // borrão sólido e arredondado, e passa nos filtros acima — o que a elimina é a área:
  // uma bolha de 4,2mm tem ~36% da área de uma marca de 7mm.
  const maiorArea = Math.max(...candidatos.map((c) => c.area));
  const semelhantes = candidatos
    .filter((c) => c.area >= maiorArea * 0.45)
    .map((c) => ({ x: c.somaX / c.area, y: c.somaY / c.area, area: c.area }));

  if (semelhantes.length < 4) return null;

  // Ordena: quando o QR já foi lido, preferimos candidatos próximos a ele (as marcas
  // reais ficam logo abaixo do QR). Sem âncora, usamos área decrescente.
  // Limitamos a N_CANDS candidatos: C(12,4)=495 combinações, custo desprezível.
  const N_CANDS = Math.min(semelhantes.length, 12);
  const ordenados = ancoraQr
    ? [...semelhantes]
        .sort((a, b) =>
          Math.hypot(a.x - ancoraQr.x, a.y - ancoraQr.y) -
          Math.hypot(b.x - ancoraQr.x, b.y - ancoraQr.y)
        )
        .slice(0, N_CANDS)
    : [...semelhantes].sort((a, b) => b.area - a.area).slice(0, N_CANDS);

  let melhorQuad: Ponto[] | null = null;
  let melhorPontuacao = Infinity;

  for (let i = 0; i < ordenados.length; i++) {
    for (let j = i + 1; j < ordenados.length; j++) {
      for (let k = j + 1; k < ordenados.length; k++) {
        for (let l = k + 1; l < ordenados.length; l++) {
          const grupo = [ordenados[i], ordenados[j], ordenados[k], ordenados[l]];

          // Áreas parecidas entre si — a marca impressa é igual nos 4 cantos.
          const areas = grupo.map((p) => p.area);
          if (Math.max(...areas) / Math.min(...areas) > 2.5) continue;

          // Pontos bem espaçados (não são 4 sujeiras coladas).
          let colados = false;
          for (let a = 0; a < 4 && !colados; a++) {
            for (let b = a + 1; b < 4; b++) {
              if (Math.hypot(grupo[a].x - grupo[b].x, grupo[a].y - grupo[b].y) < 15) {
                colados = true; break;
              }
            }
          }
          if (colados) continue;

          // Quadrilátero mínimo — evita 4 sujeiras num pequeno cluster.
          // ATENÇÃO: os pontos chegam em ordem de distância ao QR (ou de área),
          // não em ordem de ângulo — portanto areaPoligono() poderia devolver 0
          // para um bowtie. Usamos a área do bounding box, que é sempre correta.
          const pts = grupo.map(({ x, y }) => ({ x, y }));
          const bboxW = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
          const bboxH = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
          if (bboxW * bboxH < areaImagem * 0.015) continue;

          const orientado = ordenarCantos(pts, aspectoAlvo, ancoraQr);
          if (!orientado) continue;

          // Pontuação = erro de aspecto + penalidade de distância ao QR.
          // Com a âncora QR, preferimos o quarteto cujo TL fica mais perto do QR.
          let pontuacao = orientado.erro;
          if (ancoraQr) {
            const distTL = Math.hypot(orientado.quad[0].x - ancoraQr.x, orientado.quad[0].y - ancoraQr.y);
            pontuacao += (distTL / width) * 0.15;
          }

          if (pontuacao < melhorPontuacao) {
            melhorPontuacao = pontuacao;
            melhorQuad = orientado.quad;
          }
        }
      }
    }
  }

  return melhorQuad;
}


function ordenarCantos(pontos: Ponto[], aspectoAlvo: number, ancoraQr?: Ponto | null): { quad: Ponto[]; erro: number } | null {
  const cx = pontos.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pontos.reduce((s, p) => s + p.y, 0) / 4;

  // Ângulo crescente com y para baixo = sentido horário na imagem, a mesma ordem em que
  // CartaoGeom lista as marcas (TL, TR, BR, BL).
  const ciclo = [...pontos].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  const candidatos = [0, 1, 2, 3].map((giro) => {
    const q = [0, 1, 2, 3].map((i) => ciclo[(i + giro) % 4]);
    const lado = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);
    // Média dos dois lados opostos: em perspectiva eles não são iguais, e usar um só
    // faria a escolha depender de qual metade da folha estava mais perto da câmera.
    const largura = (lado(q[0], q[1]) + lado(q[3], q[2])) / 2;
    const altura = (lado(q[1], q[2]) + lado(q[0], q[3])) / 2;
    const aspecto = altura === 0 ? Infinity : largura / altura;
    return { q, erro: Math.abs(Math.log(aspecto / aspectoAlvo)) };
  });

  candidatos.sort((a, b) => a.erro - b.erro);

  // Proporção muito longe da esperada = os quatro pontos não são as marcas do cartão.
  // Acontece quando um canto sai do quadro: sobram três marcas e uma bolha preenchida
  // ocupa o lugar da quarta, o que produziria uma leitura completa, plausível e errada
  // — exatamente o defeito que ninguém percebe. Melhor não ler.
  if (candidatos[0].erro > TOLERANCIA_ASPECTO) return null;

  const [primeiro, segundo] = candidatos;
  if (!segundo) return { quad: primeiro.q, erro: primeiro.erro };

  // Sobram dois candidatos: a orientação certa e ela girada 180 graus. Escolher errado
  // aqui não produz erro visível — produz uma folha lida ao contrário, em que as bolhas
  // caem nos vãos entre as linhas e TUDO sai em branco. O servidor aceitaria isso como
  // "o aluno não respondeu nada" e gravaria zero.
  //
  // O QR resolve sem ambiguidade: ele é impresso acima e à esquerda da grade, então o
  // canto superior esquerdo do cartão é o que está mais perto dele.
  if (ancoraQr) {
    const distTL = (c: typeof primeiro) => Math.hypot(c.q[0].x - ancoraQr.x, c.q[0].y - ancoraQr.y);
    const melhor = distTL(primeiro) <= distTL(segundo) ? primeiro : segundo;
    return { quad: melhor.q, erro: melhor.erro };
  }

  // Sem o QR no quadro, resta supor que ninguém fotografa o cartão de cabeça para baixo
  // e ficar com a borda mais alta na imagem. Isso só vale com a folha aproximadamente
  // em pé: com o celular deitado as duas ficam empatadas, e chutar ali é justamente
  // como se grava um zero indevido. Nesse caso é melhor não ler — a tela continua
  // tentando no quadro seguinte, e uma leitura que demora é infinitamente melhor que
  // uma leitura errada.
  const alturaDe = (c: typeof primeiro) => c.q[0].y + c.q[1].y;
  const diagonal = Math.hypot(primeiro.q[0].x - primeiro.q[2].x, primeiro.q[0].y - primeiro.q[2].y);
  if (Math.abs(alturaDe(primeiro) - alturaDe(segundo)) < diagonal * 0.5) return null;

  const melhor = alturaDe(primeiro) <= alturaDe(segundo) ? primeiro : segundo;
  return { quad: melhor.q, erro: melhor.erro };
}

function areaPoligono(p: Ponto[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a) / 2;
}

// ------------------------------------------------------------------------------------
// Homografia
// ------------------------------------------------------------------------------------

/**
 * Homografia que leva os quatro pontos de `origem` (mm no papel) nos de `destino` (px
 * na foto). Monta o sistema 8x8 do DLT e resolve por eliminação de Gauss com pivoteamento.
 */
function calcularHomografia(origem: Ponto[], destino: Ponto[]): number[] | null {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = origem[i];
    const { x: u, y: v } = destino[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivo = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivo][col])) pivo = r;
    if (Math.abs(A[pivo][col]) < 1e-9) return null;
    [A[col], A[pivo]] = [A[pivo], A[col]];

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }

  const h = A.map((linha, i) => linha[n] / linha[i]);
  return [...h, 1];
}

function projetar(h: number[], x: number, y: number): Ponto {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

// ------------------------------------------------------------------------------------
// Amostragem das bolhas
// ------------------------------------------------------------------------------------

/**
 * Escuridão média (0..1) dentro de um disco. O raio vem projetado junto com o centro,
 * então uma bolha no canto distante da foto — que a perspectiva deixa menor — é
 * amostrada na proporção certa.
 */
function escuridao(cinza: Uint8ClampedArray, width: number, height: number, centro: Ponto, raio: number): number {
  const r = Math.max(1.5, raio);
  const x0 = Math.max(0, Math.floor(centro.x - r));
  const x1 = Math.min(width - 1, Math.ceil(centro.x + r));
  const y0 = Math.max(0, Math.floor(centro.y - r));
  const y1 = Math.min(height - 1, Math.ceil(centro.y + r));

  let soma = 0;
  let n = 0;
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = y - centro.y;
    for (let x = x0; x <= x1; x++) {
      const dx = x - centro.x;
      if (dx * dx + dy * dy > r2) continue;
      soma += 255 - cinza[y * width + x];
      n++;
    }
  }
  return n === 0 ? 0 : soma / n / 255;
}

// ------------------------------------------------------------------------------------
// API
// ------------------------------------------------------------------------------------

export interface QrLido {
  valor: string;
  /** Centro do QR na imagem. É a âncora de orientação do cartão — ver ordenarCantos. */
  centro: Ponto;
}

function media(pontos: Ponto[]): Ponto {
  return {
    x: pontos.reduce((s, p) => s + p.x, 0) / pontos.length,
    y: pontos.reduce((s, p) => s + p.y, 0) / pontos.length,
  };
}

/**
 * Lê o QR do quadro e devolve o conteúdo E a posição dele. Usa a API nativa quando
 * existe (bem mais rápida) e cai no jsQR.
 */
export async function lerQrCode(img: ImageData): Promise<QrLido | null> {
  type Achado = { rawValue: string; cornerPoints?: Ponto[]; boundingBox?: DOMRectReadOnly };
  type Detector = { detect(fonte: ImageData): Promise<Achado[]> };
  const ctor = (globalThis as unknown as {
    BarcodeDetector?: new (o: { formats: string[] }) => Detector;
  }).BarcodeDetector;

  if (ctor) {
    try {
      const detector = new ctor({ formats: ['qr_code'] });
      const [achado] = await detector.detect(img);
      if (achado?.rawValue) {
        const cantos = achado.cornerPoints;
        const centro = cantos && cantos.length > 0
          ? media(cantos)
          : achado.boundingBox
            ? { x: achado.boundingBox.x + achado.boundingBox.width / 2, y: achado.boundingBox.y + achado.boundingBox.height / 2 }
            : null;
        if (centro) return { valor: achado.rawValue, centro };
      }
    } catch {
      // Alguns navegadores expõem o construtor mas falham em detect(); segue no jsQR.
    }
  }

  const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  if (!r?.data) return null;
  const l = r.location;
  return {
    valor: r.data,
    centro: media([l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner]),
  };
}

/**
 * Lê as marcações do cartão.
 *
 * `ancoraQr` é o centro do QR Code no mesmo quadro; passá-lo é o que permite ler com o
 * celular em qualquer inclinação, inclusive deitado. Sem ele a leitura ainda funciona,
 * mas só com a folha aproximadamente em pé.
 *
 * Devolve null quando não conseguiu localizar as quatro marcas COM CERTEZA — a tela
 * trata isso como "ainda procurando a folha", não como erro.
 */
export function lerCartao(img: ImageData, geom: CartaoGeom, ancoraQr?: Ponto | null): LeituraCartao | null {
  const { width, height } = img;
  const cinza = paraCinza(img);
  const bin = binarizar(cinza, width, height);
  const marcas = acharMarcas(componentes(bin, width, height), width, height, geom.larguraMm / geom.alturaMm, ancoraQr);
  if (!marcas) return null;

  const cantosPapel: Ponto[] = [
    { x: 0, y: 0 },
    { x: geom.larguraMm, y: 0 },
    { x: geom.larguraMm, y: geom.alturaMm },
    { x: 0, y: geom.alturaMm },
  ];

  const h = calcularHomografia(cantosPapel, marcas);
  if (!h) return null;

  // Amostra o miolo da bolha, não a bolha inteira: o anel impresso é tinta preta e
  // entraria em toda medição, empurrando bolha vazia e bolha marcada para perto.
  const raioAmostraMm = (BOLHA_MM / 2) * 0.6;

  const marcacoes: string[] = [];
  const linhasDuvidosas: number[] = [];
  let piorSeparacao = 1;

  for (const linha of geom.linhas) {
    if (linha.bolhas.length === 0) {
      marcacoes.push('');
      continue;
    }

    const valoresBrutos = linha.bolhas.map((b) => {
      const centro = projetar(h, b.x, b.y);
      const borda = projetar(h, b.x + raioAmostraMm, b.y);
      return escuridao(cinza, width, height, centro, Math.hypot(borda.x - centro.x, borda.y - centro.y));
    });

    // Subtração de fundo local: folhas impressas em 2 por página ficam menores e o
    // limiar adaptativo de Bradley pode subtrair menos, deixando as bolhas vazias com
    // uma escuridão de fundo (~0,25) que se confunde com lápis fraco. Subtraindo o
    // mínimo da linha (= fundo estimado) todos os valores ficam relativos, e a decisão
    // não depende mais da iluminação nem do zoom da câmera.
    //
    // O fundo é limitado a LIMIAR_MARCADA * 0.5 (= 0,15) para não ocorrer
    // sobre-subtração no caso em que todas as bolhas estão preenchidas (marcação dupla
    // `*`): sem o limite, min seria o valor das bolhas cheias e tudo viraria zero.
    const fundoBruto = Math.min(...valoresBrutos);
    const fundo = Math.min(fundoBruto, LIMIAR_MARCADA * 0.3);
    const valores = valoresBrutos.map((v) => Math.max(0, v - fundo));

    const ordenados = [...valores].sort((a, b) => b - a);
    const primeiro = ordenados[0];
    const segundo = ordenados[1] ?? 0;

    let decisao: string;
    if (primeiro < LIMIAR_MARCADA) {
      decisao = '';
    } else if (segundo >= LIMIAR_MARCADA && segundo > primeiro * FRACAO_DUPLA) {
      decisao = '*';
    } else {
      decisao = linha.bolhas[valores.indexOf(primeiro)].letra;
    }
    marcacoes.push(decisao);

    // "Quão longe estamos de mudar de ideia" em cada caso:
    //   em branco -> o quanto falta para a mais escura virar marcação;
    //   dupla     -> o quanto a segunda passa do limiar (quanto mais, mais certo que
    //                são duas mesmo — dupla é resultado definido, não indecisão, e
    //                medi-la como `primeiro - segundo` zerava a confiança da folha
    //                inteira por causa de uma única questão anulada);
    //   marcada   -> a vantagem sobre a concorrente.
    const separacao =
      decisao === '' ? LIMIAR_MARCADA - primeiro
        : decisao === '*' ? segundo - LIMIAR_MARCADA
          : primeiro - segundo;
    if (separacao < SEPARACAO_MINIMA) linhasDuvidosas.push(linha.linha);
    if (separacao < piorSeparacao) piorSeparacao = separacao;
  }

  return {
    marcacoes,
    confianca: Math.max(0, Math.min(1, piorSeparacao / (SEPARACAO_MINIMA * 2))),
    linhasDuvidosas,
    marcas,
  };
}
