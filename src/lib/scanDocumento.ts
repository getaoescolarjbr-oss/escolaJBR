// Tratamento de foto de documento para ficar com cara de escaneado, 100% no aparelho
// (nada sai do celular antes do envio): acha as bordas do papel, corrige a perspectiva,
// nivela a iluminação (tira sombra e mancha da foto) e aumenta o contraste do texto.

export interface Ponto { x: number; y: number }
export type Quad = [Ponto, Ponto, Ponto, Ponto]; // topo-esq, topo-dir, baixo-dir, baixo-esq
export type ModoScan = 'pb' | 'cor' | 'original';

const LADO_MAX_ORIGEM = 3000;   // foto de 12 MP vira ~3000 px: basta para A4 a 200 dpi
const LADO_MAX_SAIDA = 2339;    // A4 a 200 dpi (1654 x 2339)

export async function carregarImagem(arquivo: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error('Não foi possível abrir a imagem.'));
      i.src = url;
    });
    // O navegador já aplica a orientação EXIF (foto tirada de pé ou deitada).
    const escala = Math.min(1, LADO_MAX_ORIGEM / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- detecção das bordas -----------------------------------------------------

function otsu(hist: number[], total: number): number {
  let soma = 0;
  for (let i = 0; i < 256; i++) soma += i * hist[i];
  let somaB = 0, wB = 0, melhor = 0, limiar = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    somaB += t * hist[t];
    const mB = somaB / wB, mF = (soma - somaB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > melhor) { melhor = v; limiar = t; }
  }
  return limiar;
}

export function quadPadrao(w: number, h: number): Quad {
  const mx = w * 0.04, my = h * 0.04;
  return [{ x: mx, y: my }, { x: w - mx, y: my }, { x: w - mx, y: h - my }, { x: mx, y: h - my }];
}

// Procura a maior região clara (o papel) e devolve seus 4 cantos. Se não achar nada
// convincente, devolve uma moldura quase do tamanho da foto para a pessoa ajustar.
export function detectarBordas(origem: HTMLCanvasElement): Quad {
  const escala = Math.min(1, 480 / Math.max(origem.width, origem.height));
  const w = Math.max(8, Math.round(origem.width * escala));
  const h = Math.max(8, Math.round(origem.height * escala));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'blur(2px)';
  ctx.drawImage(origem, 0, 0, w, h);
  const dados = ctx.getImageData(0, 0, w, h).data;

  const cinza = new Uint8Array(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) {
    const g = (dados[i * 4] * 299 + dados[i * 4 + 1] * 587 + dados[i * 4 + 2] * 114) / 1000 | 0;
    cinza[i] = g; hist[g]++;
  }
  const limiar = otsu(hist, w * h);

  const rotulo = new Int32Array(w * h);
  const pilha = new Int32Array(w * h);
  let melhorRotulo = 0, melhorArea = 0, atual = 0;
  for (let i = 0; i < w * h; i++) {
    if (cinza[i] <= limiar || rotulo[i]) continue;
    atual++;
    let topo = 0, area = 0;
    pilha[topo++] = i; rotulo[i] = atual;
    while (topo) {
      const p = pilha[--topo]; area++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && !rotulo[p - 1] && cinza[p - 1] > limiar) { rotulo[p - 1] = atual; pilha[topo++] = p - 1; }
      if (x < w - 1 && !rotulo[p + 1] && cinza[p + 1] > limiar) { rotulo[p + 1] = atual; pilha[topo++] = p + 1; }
      if (y > 0 && !rotulo[p - w] && cinza[p - w] > limiar) { rotulo[p - w] = atual; pilha[topo++] = p - w; }
      if (y < h - 1 && !rotulo[p + w] && cinza[p + w] > limiar) { rotulo[p + w] = atual; pilha[topo++] = p + w; }
    }
    if (area > melhorArea) { melhorArea = area; melhorRotulo = atual; }
  }
  if (melhorArea < w * h * 0.2) return quadPadrao(origem.width, origem.height);

  let tl = Infinity, br = -Infinity, tr = -Infinity, bl = Infinity;
  let pTl = { x: 0, y: 0 }, pBr = { x: w, y: h }, pTr = { x: w, y: 0 }, pBl = { x: 0, y: h };
  for (let i = 0; i < w * h; i++) {
    if (rotulo[i] !== melhorRotulo) continue;
    const x = i % w, y = (i / w) | 0;
    if (x + y < tl) { tl = x + y; pTl = { x, y }; }
    if (x + y > br) { br = x + y; pBr = { x, y }; }
    if (x - y > tr) { tr = x - y; pTr = { x, y }; }
    if (x - y < bl) { bl = x - y; pBl = { x, y }; }
  }
  const f = 1 / escala;
  return [pTl, pTr, pBr, pBl].map((p) => ({ x: p.x * f, y: p.y * f })) as Quad;
}

// ---------- correção de perspectiva -------------------------------------------------

// Resolve a homografia que leva o retângulo de saída (0,0)-(W,H) ao quadrilátero da foto.
function homografia(quad: Quad, W: number, H: number): number[] {
  const dst = [[0, 0], [W, 0], [W, H], [0, H]];
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i];
    const { x: u, y: v } = quad[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = c + 1; r < 8; r++) {
      const k = A[r][c] / A[c][c];
      for (let j = c; j < 9; j++) A[r][j] -= k * A[c][j];
    }
  }
  const s = new Array(8).fill(0);
  for (let r = 7; r >= 0; r--) {
    let t = A[r][8];
    for (let j = r + 1; j < 8; j++) t -= A[r][j] * s[j];
    s[r] = t / A[r][r];
  }
  return s;
}

const dist = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);

export function recortarPagina(origem: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const larg = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2;
  const alt = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2;
  let proporcao = larg / alt;
  const a4 = 210 / 297;
  // Papel A4 fotografado levemente torto: encaixa na proporção exata em vez de deformar.
  if (Math.abs(proporcao - a4) / a4 < 0.12) proporcao = a4;
  else if (Math.abs(proporcao - 1 / a4) / (1 / a4) < 0.12) proporcao = 1 / a4;
  const W = proporcao >= 1 ? LADO_MAX_SAIDA : Math.round(LADO_MAX_SAIDA * proporcao);
  const H = proporcao >= 1 ? Math.round(LADO_MAX_SAIDA / proporcao) : LADO_MAX_SAIDA;

  const [a, b, c, d, e, f, g, h] = homografia(quad, W, H);
  const src = origem.getContext('2d')!.getImageData(0, 0, origem.width, origem.height);
  const sw = src.width, sh = src.height, sd = src.data;
  const saida = document.createElement('canvas');
  saida.width = W; saida.height = H;
  const sctx = saida.getContext('2d')!;
  const out = sctx.createImageData(W, H);
  const od = out.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const den = g * x + h * y + 1;
      let u = (a * x + b * y + c) / den;
      let v = (d * x + e * y + f) / den;
      u = u < 0 ? 0 : u > sw - 1.001 ? sw - 1.001 : u;
      v = v < 0 ? 0 : v > sh - 1.001 ? sh - 1.001 : v;
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) {
        od[o + k] = sd[i00 + k] * (1 - fx) * (1 - fy) + sd[i10 + k] * fx * (1 - fy) + sd[i01 + k] * (1 - fx) * fy + sd[i11 + k] * fx * fy;
      }
      od[o + 3] = 255;
    }
  }
  sctx.putImageData(out, 0, 0);
  return saida;
}

// ---------- melhoria da imagem ------------------------------------------------------

function filtroMax(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), dst = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, src[y * w + k]);
    tmp[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, tmp[k * w + x]);
    dst[y * w + x] = m;
  }
  return dst;
}
function filtroMin(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const inv = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) inv[i] = 255 - src[i];
  const m = filtroMax(inv, w, h, r);
  for (let i = 0; i < m.length; i++) m[i] = 255 - m[i];
  return m;
}
function suavizar(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), dst = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) { s += src[y * w + k]; n++; }
    tmp[y * w + x] = s / n;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) { s += tmp[k * w + x]; n++; }
    dst[y * w + x] = s / n;
  }
  return dst;
}

// Mapa do "fundo" (papel + sombras): o que sobra depois de apagar o texto do quadro.
function mapaDeFundo(pagina: HTMLCanvasElement): HTMLCanvasElement {
  const pw = Math.max(16, Math.round(pagina.width / 8)), ph = Math.max(16, Math.round(pagina.height / 8));
  const p = document.createElement('canvas');
  p.width = pw; p.height = ph;
  const pc = p.getContext('2d')!;
  pc.imageSmoothingQuality = 'high';
  pc.drawImage(pagina, 0, 0, pw, ph);
  const d = pc.getImageData(0, 0, pw, ph).data;
  let g: Float32Array = new Float32Array(pw * ph);
  for (let i = 0; i < pw * ph; i++) g[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
  g = filtroMin(filtroMax(g, pw, ph, 5), pw, ph, 5); // fechamento: apaga traços escuros finos
  g = suavizar(suavizar(g, pw, ph, 3), pw, ph, 3);
  const img = pc.createImageData(pw, ph);
  for (let i = 0; i < pw * ph; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g[i]; img.data[i * 4 + 3] = 255; }
  pc.putImageData(img, 0, 0);
  const grande = document.createElement('canvas');
  grande.width = pagina.width; grande.height = pagina.height;
  const gc = grande.getContext('2d')!;
  gc.imageSmoothingQuality = 'high';
  gc.drawImage(p, 0, 0, grande.width, grande.height);
  return grande;
}

const suave = (t: number) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

export function melhorarPagina(pagina: HTMLCanvasElement, modo: ModoScan): HTMLCanvasElement {
  const saida = document.createElement('canvas');
  saida.width = pagina.width; saida.height = pagina.height;
  const ctx = saida.getContext('2d')!;
  if (modo === 'original') { ctx.drawImage(pagina, 0, 0); return saida; }

  const fundo = mapaDeFundo(pagina).getContext('2d')!.getImageData(0, 0, pagina.width, pagina.height).data;
  const img = pagina.getContext('2d')!.getImageData(0, 0, pagina.width, pagina.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const bg = Math.max(fundo[i], 1);
    const k = 255 / bg;
    if (modo === 'pb') {
      const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 * k;
      const v = suave((g - 80) / (190 - 80)) * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    } else {
      for (let c = 0; c < 3; c++) d[i + c] = suave((d[i + c] * k - 25) / (232 - 25)) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return saida;
}

export function paraJpeg(canvas: HTMLCanvasElement, qualidade = 0.85): Promise<Blob> {
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Falha ao gerar a imagem.'))), 'image/jpeg', qualidade));
}
