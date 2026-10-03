// Geometria e CSS da FOLHA DE REDAÇÃO impressa (A4, 30 linhas).
//
// Mesma ideia de cartaoResposta.ts: o que é impresso e o que a câmera vai procurar vêm
// dos mesmos números. Tudo em milímetros, medido a partir do canto superior esquerdo da
// área útil da página (200 x 283 mm: A4 menos a margem de 5/6 mm do @page de printProva).
//
// As quatro marcas pretas dos cantos servem para endireitar a foto (a mesma homografia
// que lib/omr.ts já faz para o cartão-resposta). A identificação do aluno (nome, QR,
// turma) fica FORA da caixa de texto: assim dá para recortar só a caixa e mandar à IA
// sem dado pessoal.

export const FOLHA_REDACAO_LARGURA_MM = 200;
export const FOLHA_REDACAO_ALTURA_MM = 283;
export const FOLHA_REDACAO_MARCA_MM = 6;
export const LINHAS_FOLHA_REDACAO = 30;

/** Centros das 4 marcas de enquadramento (mm). */
export const FOLHA_REDACAO_MARCAS = [
  { x: 6, y: 6 },
  { x: 194, y: 6 },
  { x: 6, y: 277 },
  { x: 194, y: 277 },
] as const;

/** Caixa das 30 linhas (mm). A coluna `gutter` leva a numeração e não faz parte do texto. */
export const FOLHA_REDACAO_CAIXA = {
  x: 14,
  y: 50,
  largura: 172,
  altura: 192,
  gutter: 9,
} as const;

export const FOLHA_REDACAO_PASSO_LINHA_MM = FOLHA_REDACAO_CAIXA.altura / LINHAS_FOLHA_REDACAO;

/** Retângulo (mm) que vai para a leitura de letra: só as linhas, sem a numeração. */
export function retanguloTextoRedacao() {
  const c = FOLHA_REDACAO_CAIXA;
  return { x: c.x + c.gutter, y: c.y, largura: c.largura - c.gutter, altura: c.altura };
}

export const FOLHA_REDACAO_CSS = `
  .folha-red {
    position: relative;
    width: ${FOLHA_REDACAO_LARGURA_MM}mm;
    height: ${FOLHA_REDACAO_ALTURA_MM - 2}mm;
    overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    break-inside: avoid;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .folha-red * { box-sizing: border-box; }
  .folha-red-abs { position: absolute; }
  .folha-red-marca { position: absolute; background: #000; transform: translate(-50%, -50%); }
  .folha-red-caixa { position: absolute; border: 0.35mm solid #000; }
  .folha-red-gutter { position: absolute; top: 0; bottom: 0; border-right: 0.2mm solid #000; }
  .folha-red-linha { position: absolute; left: 0; right: 0; border-top: 0.18mm solid #444; }
  .folha-red-num { position: absolute; left: 0; text-align: center; font-weight: 700; font-size: 7.5pt; line-height: 1; }
  .folha-red-titulo { font-size: 14pt; font-weight: 900; letter-spacing: 0.3px; }
  .folha-red-escola { font-size: 9.5pt; font-weight: 700; }
  .folha-red-dados { font-size: 8.5pt; line-height: 1.45; }
  .folha-red-instr { font-size: 6.4pt; line-height: 1.35; }
  .folha-red-instr b { font-weight: 700; }
  .folha-red-quadro { position: absolute; border: 0.3mm solid #000; font-size: 6.5pt; }
  .folha-red-quadro table { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; }
  .folha-red-quadro th, .folha-red-quadro td { border: 0.2mm solid #000; text-align: center; padding: 0; }
  .folha-red-quadro th { font-weight: 700; height: 4.5mm; background: #eee; }
  .folha-red-quadro-tit { position: absolute; left: 0; right: 0; top: -3.6mm; font-size: 6.5pt; font-weight: 700; }
`;
