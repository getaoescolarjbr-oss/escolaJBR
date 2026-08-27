export function printProva(ref: HTMLElement | null, tituloDocumento: string) {
  if (!ref) return;

  const clone = ref.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, [class*="no-print"]').forEach((el) => el.remove());

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${tituloDocumento}</title>
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

    .questoes-coluna.duas-colunas {
      column-count: 2;
      column-gap: 18px;
      column-rule: 1px solid #999;
    }

    .prova-nota-box {
      display: flex;
      flex-direction: column;
      width: 74px;
      min-width: 74px;
      flex-shrink: 0;
      border: 1.5px solid #002677;
      border-radius: 6px;
      overflow: hidden;
    }

    .prova-nota-label {
      font-size: 0.72em;
      font-weight: 900;
      color: #002677;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 3px 0;
      border-bottom: 1.5px solid #002677;
      background: #f0f4ff;
    }

    .questao {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #ddd;
    }

    .questao-num { font-weight: 900; color: #002677; }

    .questao-enunciado { margin: 3px 0 5px; line-height: 1.35; text-align: justify; }

    .questao-img { max-width: 100%; margin: 4px 0; }

    .alternativas-linha { display: flex; flex-wrap: wrap; gap: 4px 14px; }

    .alternativas-coluna { display: flex; flex-direction: column; gap: 3px; }

    .alternativa { display: flex; gap: 4px; align-items: flex-start; }

    .alternativa b { flex-shrink: 0; }

    .alternativa-texto { flex: 1; text-align: justify; }

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
