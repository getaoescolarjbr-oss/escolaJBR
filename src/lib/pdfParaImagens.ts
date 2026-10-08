import type { ImagemRgba } from './recorteFolhaRedacao';

// PDF escaneado (scanner da impressora, uma página por folha) -> páginas como imagem, para o mesmo caminho das fotos.
// A biblioteca (pdf.js) só é baixada quando alguém envia um PDF: fica fora do carregamento normal do portal.

/** Lado maior, em px, em que cada página é desenhada: ~200 dpi numa A4, de sobra para o QR e as marcas. */
const LADO_PAGINA_PX = 2400;

export interface PdfAberto {
  paginas: number;
  /** Desenha a página `n` (1 a `paginas`) como imagem. Uma por vez, para não encher a memória. */
  renderizar: (n: number) => Promise<ImagemRgba>;
  fechar: () => void;
}

export function ehPdf(arquivo: File): boolean {
  return arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name);
}

export async function abrirPdf(arquivo: File): Promise<PdfAberto> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  const doc = await tarefa.promise;

  return {
    paginas: doc.numPages,
    renderizar: async (n: number) => {
      const pagina = await doc.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const viewport = pagina.getViewport({ scale: LADO_PAGINA_PX / Math.max(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas indisponível');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvas, canvasContext: ctx, viewport }).promise;
      pagina.cleanup();
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { width: canvas.width, height: canvas.height, data: d.data };
    },
    fechar: () => { void tarefa.destroy(); },
  };
}
