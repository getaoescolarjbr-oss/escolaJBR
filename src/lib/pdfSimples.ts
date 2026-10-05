// Monta um PDF só com imagens JPEG (uma por página, preenchendo a folha). Suficiente para
// documentos escaneados e sem depender de biblioteca externa.

export interface PaginaPdf {
  jpeg: Uint8Array;
  largura: number; // pixels
  altura: number;
}

const PT_A4_CURTO = 595.28;
const PT_A4_LONGO = 841.89;

export function montarPdf(paginas: PaginaPdf[]): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let tamanho = 0;
  const gravar = (dados: string | Uint8Array) => {
    const b = typeof dados === 'string' ? enc.encode(dados) : dados;
    partes.push(b); tamanho += b.length;
  };
  const objeto = (n: number, corpo: string | (() => void)) => {
    offsets[n] = tamanho;
    gravar(`${n} 0 obj\n`);
    if (typeof corpo === 'string') gravar(corpo); else corpo();
    gravar('\nendobj\n');
  };

  // Objetos: 1 catálogo, 2 árvore de páginas, depois 3 por página (página, conteúdo, imagem).
  const ids = paginas.map((_, i) => 3 + i * 3);
  gravar('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objeto(2, `<< /Type /Pages /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] /Count ${paginas.length} >>`);

  paginas.forEach((p, i) => {
    const pg = ids[i], ct = pg + 1, im = pg + 2;
    const paisagem = p.largura > p.altura;
    const W = (paisagem ? PT_A4_LONGO : PT_A4_CURTO).toFixed(2);
    const H = (paisagem ? PT_A4_CURTO : PT_A4_LONGO).toFixed(2);
    objeto(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    const conteudo = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    objeto(ct, `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`);
    objeto(im, () => {
      gravar(`<< /Type /XObject /Subtype /Image /Width ${p.largura} /Height ${p.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      gravar(p.jpeg);
      gravar('\nendstream');
    });
  });

  const total = 3 + paginas.length * 3;
  const xref = tamanho;
  gravar(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) gravar(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  gravar(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes as BlobPart[], { type: 'application/pdf' });
}
