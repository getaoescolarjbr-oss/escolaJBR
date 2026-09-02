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
 */
function acharMarcas(comps: Componente[], width: number, height: number, aspectoAlvo: number): Ponto[] | null {
  const areaImagem = width * height;

  const candidatos = comps.filter((c) => {
    const larg = c.maxX - c.minX + 1;
    const alt = c.maxY - c.minY + 1;
    if (larg < 5 || alt < 5) return false;

    // Faixa larga de propósito: a marca é um quadrado no papel, mas a perspectiva de um
    // celular inclinado sobre a mesa a entrega como paralelogramo.
    const proporcao = larg / alt;
    if (proporcao < 0.5 || proporcao > 2) return false;

    // Preenchimento do retângulo envolvente. O limite é BAIXO por um motivo geométrico:
    // um quadrado girado não preenche o próprio bounding box — a 12 graus já cai para
    // 0,71 e a 45 graus para 0,50. Exigir "quase 1" aqui equivale a exigir a folha no
    // prumo, e quem trabalha com a folha no prumo não precisa de homografia nenhuma.
    if (c.area / (larg * alt) < 0.55) return false;

    const rel = c.area / areaImagem;
    return rel > 0.00012 && rel < 0.02;
  });

  if (candidatos.length < 4) return null;

  // As quatro marcas são do mesmo tamanho impresso. Uma bolha preenchida também é um
  // borrão sólido e arredondado, e passa nos filtros acima — o que a elimina é a área:
  // uma bolha de 5mm tem ~40% da área de uma marca de 7mm.
  const maiorArea = Math.max(...candidatos.map((c) => c.area));
  const semelhantes = candidatos.filter((c) => c.area >= maiorArea * 0.55);
  if (semelhantes.length < 4) return null;

  const pontos = semelhantes.map((c) => ({ x: c.somaX / c.area, y: c.somaY / c.area, area: c.area }));

  // Os quatro extremos das duas diagonais: a folha é o maior retângulo em cena, então
  // as marcas dela ficam nos extremos e o que houver de ruído sobra no meio.
  type PontoArea = (typeof pontos)[number];
  const extremo = (pontuar: (p: PontoArea) => number, maior: boolean) =>
    pontos.reduce((melhor, p) => {
      const a = pontuar(p);
      const b = pontuar(melhor);
      return maior ? (a > b ? p : melhor) : (a < b ? p : melhor);
    });

  const quad = [
    extremo((p) => p.x + p.y, false),
    extremo((p) => p.x - p.y, true),
    extremo((p) => p.x + p.y, true),
    extremo((p) => p.x - p.y, false),
  ];

  // Quatro pontos distintos: sem isto, um mesmo borrão poderia ser eleito duas vezes.
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (Math.hypot(quad[i].x - quad[j].x, quad[i].y - quad[j].y) < 20) return null;
    }
  }

  // Um quadrilátero pequeno demais não é a folha, são quatro sujeiras agrupadas.
  if (areaPoligono(quad) < areaImagem * 0.08) return null;

  // Os quatro escolhidos precisam ser parecidos ENTRE SI, não só grandes. É esta
  // checagem que pega o caso perigoso: um canto da folha fora do quadro deixa três
  // marcas e uma bolha preenchida assumindo o lugar da quarta — e daí sairia uma
  // leitura completa, plausível e inteiramente errada, que ninguém percebe.
  const areas = quad.map((p) => p.area);
  if (Math.max(...areas) / Math.min(...areas) > 2.2) return null;

  return ordenarCantos(quad.map(({ x, y }) => ({ x, y })), aspectoAlvo);
}

function ordenarCantos(pontos: Ponto[], aspectoAlvo: number): Ponto[] | null {
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

  // Os dois melhores são a mesma orientação e a de 180 graus; fica a que não está de
  // cabeça para baixo.
  const [primeiro, segundo] = candidatos;
  if (!segundo) return primeiro.q;
  const alturaDe = (c: typeof primeiro) => c.q[0].y + c.q[1].y;
  return alturaDe(primeiro) <= alturaDe(segundo) ? primeiro.q : segundo.q;
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

/** Lê o QR do quadro. Usa a API nativa quando existe (bem mais rápida) e cai no jsQR. */
export async function lerQrCode(img: ImageData): Promise<string | null> {
  type Detector = { detect(fonte: ImageData): Promise<{ rawValue: string }[]> };
  const ctor = (globalThis as unknown as {
    BarcodeDetector?: new (o: { formats: string[] }) => Detector;
  }).BarcodeDetector;

  if (ctor) {
    try {
      const detector = new ctor({ formats: ['qr_code'] });
      const achados = await detector.detect(img);
      if (achados.length > 0 && achados[0].rawValue) return achados[0].rawValue;
    } catch {
      // Alguns navegadores expõem o construtor mas falham em detect(); segue no jsQR.
    }
  }

  const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  return r?.data ?? null;
}

/**
 * Lê as marcações do cartão. Devolve null quando não conseguiu localizar as quatro
 * marcas — a tela trata isso como "ainda procurando a folha", não como erro.
 */
export function lerCartao(img: ImageData, geom: CartaoGeom): LeituraCartao | null {
  const { width, height } = img;
  const cinza = paraCinza(img);
  const bin = binarizar(cinza, width, height);
  const marcas = acharMarcas(componentes(bin, width, height), width, height, geom.larguraMm / geom.alturaMm);
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

    const valores = linha.bolhas.map((b) => {
      const centro = projetar(h, b.x, b.y);
      const borda = projetar(h, b.x + raioAmostraMm, b.y);
      return escuridao(cinza, width, height, centro, Math.hypot(borda.x - centro.x, borda.y - centro.y));
    });

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
