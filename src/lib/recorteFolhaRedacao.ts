// Recorte da CAIXA DE TEXTO da folha de redação a partir de uma foto/escaneamento.
//
// Mesmo princípio de lerCartao (lib/omr.ts): acha o QR (que identifica o aluno e orienta a folha),
// acha as 4 marcas pretas dos cantos, calcula a homografia papel -> foto e re-amostra só a região
// das 30 linhas, já endireitada. Esse recorte é tudo o que vai para a transcrição: sem nome, sem
// turma, sem QR. Nada disto sai do aparelho; a rede só recebe o recorte.
//
// As posições vêm de utils/folhaRedacao.ts, as mesmas que a folha impressa usa.

import jsQR from 'jsqr';
import { acharMarcas, binarizar, calcularHomografia, componentes, paraCinza, projetar } from './omr';
import type { Ponto } from './omr';
import { FOLHA_REDACAO_MARCAS, retanguloTextoRedacao } from '../utils/folhaRedacao';

/** Resolução do recorte: 8 px por mm dá ~1300 x 1540 px, nítido para letra de caneta e leve para enviar. */
const PX_POR_MM = 8;

export interface ImagemRgba {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface RecorteRedacao {
  /** Conteúdo do QR (código da alocação do aluno). */
  codigo: string;
  recorte: ImagemRgba;
  /** As 4 marcas encontradas na foto (TL, TR, BR, BL), para desenhar o contorno na tela. */
  marcas: Ponto[];
}

export type ResultadoRecorte = { ok: true; dados: RecorteRedacao } | { ok: false; motivo: string };

// Os 4 centros das marcas no papel, na ordem TL, TR, BR, BL que acharMarcas devolve.
const CANTOS_PAPEL: Ponto[] = [
  FOLHA_REDACAO_MARCAS[0],
  FOLHA_REDACAO_MARCAS[1],
  FOLHA_REDACAO_MARCAS[3],
  FOLHA_REDACAO_MARCAS[2],
].map((m) => ({ x: m.x, y: m.y }));

const ASPECTO_MARCAS =
  (FOLHA_REDACAO_MARCAS[1].x - FOLHA_REDACAO_MARCAS[0].x) / (FOLHA_REDACAO_MARCAS[2].y - FOLHA_REDACAO_MARCAS[0].y);

function amostraBilinear(img: ImagemRgba, x: number, y: number, saida: Uint8ClampedArray, o: number) {
  const { width, height, data } = img;
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  for (let c = 0; c < 3; c++) {
    const a = data[(y0 * width + x0) * 4 + c];
    const b = data[(y0 * width + x1) * 4 + c];
    const d = data[(y1 * width + x0) * 4 + c];
    const e = data[(y1 * width + x1) * 4 + c];
    saida[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
  saida[o + 3] = 255;
}

/**
 * Lê o QR, acha as marcas e devolve a caixa de texto endireitada. `ok: false` traz o motivo em
 * português para a tela dizer ao professor o que ajustar (foto cortada, sem QR, etc.).
 */
export async function recortarCaixaRedacao(img: ImagemRgba): Promise<ResultadoRecorte> {
  // O QR vem do jsQR direto (não de lerQrCode) porque aqui preciso também do TAMANHO dele na foto:
  // diferente do cartão-resposta, o QR desta folha fica DENTRO do retângulo das marcas, e os quadrados
  // sólidos dos cantos do QR são candidatos a "marca" que precisam ser descartados.
  const achado = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  if (!achado) return { ok: false, motivo: 'Não encontrei o QR Code. Enquadre a folha inteira, com o QR visível e bem iluminado.' };
  const L = achado.location;
  const centro: Ponto = {
    x: (L.topLeftCorner.x + L.topRightCorner.x + L.bottomLeftCorner.x + L.bottomRightCorner.x) / 4,
    y: (L.topLeftCorner.y + L.topRightCorner.y + L.bottomLeftCorner.y + L.bottomRightCorner.y) / 4,
  };
  const ladoQr = Math.hypot(L.topRightCorner.x - L.topLeftCorner.x, L.topRightCorner.y - L.topLeftCorner.y);

  const cinza = paraCinza(img as unknown as ImageData);
  const bin = binarizar(cinza, img.width, img.height);
  const fora = componentes(bin, img.width, img.height).filter(
    (c) => Math.hypot(c.somaX / c.area - centro.x, c.somaY / c.area - centro.y) > ladoQr * 0.85,
  );
  const marcas = acharMarcas(fora, img.width, img.height, ASPECTO_MARCAS, centro);
  if (!marcas) {
    return { ok: false, motivo: 'Não encontrei os 4 quadrados pretos dos cantos. Fotografe a folha inteira, sem cortar os cantos nem cobri-los com o dedo.' };
  }
  const qr = { valor: achado.data };

  const h = calcularHomografia(CANTOS_PAPEL, marcas);
  if (!h) return { ok: false, motivo: 'A folha ficou muito torta na foto. Tire outra, com o celular mais paralelo à mesa.' };

  const r = retanguloTextoRedacao();
  const largura = Math.round(r.largura * PX_POR_MM);
  const altura = Math.round(r.altura * PX_POR_MM);
  const saida = new Uint8ClampedArray(largura * altura * 4);
  for (let v = 0; v < altura; v++) {
    for (let u = 0; u < largura; u++) {
      const p = projetar(h, r.x + u / PX_POR_MM, r.y + v / PX_POR_MM);
      amostraBilinear(img, p.x, p.y, saida, (v * largura + u) * 4);
    }
  }
  return { ok: true, dados: { codigo: qr.valor, recorte: { width: largura, height: altura, data: saida }, marcas } };
}

/** Só no navegador: recorte -> JPEG para enviar/guardar. */
export function recorteParaJpeg(recorte: ImagemRgba, qualidade = 0.85): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = recorte.width;
  canvas.height = recorte.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas indisponível'));
  ctx.putImageData(new ImageData(recorte.data as Uint8ClampedArray<ArrayBuffer>, recorte.width, recorte.height), 0, 0);
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Falha ao gerar JPEG'))), 'image/jpeg', qualidade));
}

/** Só no navegador: arquivo de imagem (foto da câmera, galeria, escaneamento) -> pixels, com limite de tamanho. */
export async function arquivoParaImagem(arquivo: File, ladoMaximo = 2600): Promise<ImagemRgba> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, ladoMaximo / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const d = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: d.data };
}
