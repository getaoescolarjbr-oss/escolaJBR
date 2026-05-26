/**
 * Utilitário de impressão para o Portal JBR
 * Abre uma janela limpa e bem formatada para impressão
 */

interface PrintOptions {
  title: string;
  subtitle?: string;
  info?: { label: string; value: string }[];
}

export function printReport(tableRef: HTMLElement | null, options: PrintOptions) {
  if (!tableRef) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Clone the table and clean print-unfriendly classes
  const clone = tableRef.cloneNode(true) as HTMLElement;

  // Find all input and select elements in the original and set their values in the clone, or replace them with text
  const inputs = tableRef.querySelectorAll('input');
  const cloneInputs = clone.querySelectorAll('input');
  inputs.forEach((inputEl, index) => {
    const val = inputEl.value;
    const cloneInputEl = cloneInputs[index];
    if (cloneInputEl) {
      const span = document.createElement('span');
      span.textContent = val || '—';
      span.className = 'print-input-value';
      span.style.fontWeight = 'bold';
      cloneInputEl.replaceWith(span);
    }
  });

  const selects = tableRef.querySelectorAll('select');
  const cloneSelects = clone.querySelectorAll('select');
  selects.forEach((selectEl, index) => {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const val = selectedOption ? selectedOption.text : selectEl.value;
    const cloneSelectEl = cloneSelects[index];
    if (cloneSelectEl) {
      const span = document.createElement('span');
      span.textContent = val || '—';
      span.className = 'print-select-value';
      span.style.fontWeight = 'bold';
      cloneSelectEl.replaceWith(span);
    }
  });

  // Remove elements with class 'no-print'
  clone.querySelectorAll('.no-print, [class*="no-print"]').forEach(el => el.remove());

  // Remove tooltips and interactive elements from clone
  clone.querySelectorAll('.group\\/tooltip').forEach(el => {
    // Keep only the main value, remove tooltips
    const btn = el.querySelector('button');
    if (btn) {
      const span = document.createElement('span');
      span.innerHTML = btn.innerHTML;
      span.className = btn.className;
      el.replaceWith(span);
    }
  });

  // Convert remaining buttons inside clone to spans to prevent browser button styling
  clone.querySelectorAll('button').forEach(btn => {
    const span = document.createElement('span');
    span.innerHTML = btn.innerHTML;
    span.className = btn.className;
    btn.replaceWith(span);
  });

  // Remove invisible/hidden elements
  clone.querySelectorAll('.invisible, .opacity-0').forEach(el => el.remove());

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${options.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 11px;
      color: #1a1a2e;
      background: #fff;
      padding: 20px;
    }

    .print-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 3px solid #002677;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }

    .school-name {
      font-size: 17px;
      font-weight: 900;
      color: #002677;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }

    .report-title {
      font-size: 13px;
      font-weight: 700;
      color: #003366;
      margin-top: 3px;
    }

    .report-subtitle {
      font-size: 10px;
      font-weight: 600;
      color: #666;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .print-meta {
      text-align: right;
      font-size: 9px;
      color: #666;
      font-weight: 600;
    }

    .info-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      background: #f0f4ff;
      border: 1px solid #c7d7f7;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
    }

    .info-label {
      font-size: 8px;
      font-weight: 900;
      color: #002677;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .info-value {
      font-size: 11px;
      font-weight: 700;
      color: #1a1a2e;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    thead {
      background: #002677 !important;
    }

    thead th {
      background: #002677 !important;
      color: #fff !important;
      font-weight: 900;
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 8px 10px;
      border: 1px solid #001a55;
      text-align: center;
    }

    thead th:first-child { text-align: left; }

    tbody tr { page-break-inside: avoid; }

    tbody tr:nth-child(odd)  td { background: #f7f9ff; }
    tbody tr:nth-child(even) td { background: #ffffff; }

    tbody tr:hover td { background: #eef2ff; }

    tbody td {
      padding: 6px 10px;
      border: 1px solid #dde4f5;
      color: #1a1a2e;
      font-weight: 600;
      text-align: center;
      vertical-align: middle;
    }

    tbody td:first-child { text-align: left; font-weight: 700; }

    /* Color classes translated for print */
    .text-red-500, [style*="color: rgb(239, 68, 68)"],
    [style*="color: #ef4444"], [style*="color: rgb(220, 38, 38)"] { color: #dc2626 !important; }

    .text-green-500, [style*="color: rgb(34, 197, 94)"],
    [style*="color: #22c55e"] { color: #16a34a !important; }

    .text-yellow-500 { color: #ca8a04 !important; }
    .text-blue-500   { color: #2563eb !important; }

    /* Status badges */
    [class*="rounded-full"], [class*="rounded-lg"] {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 20px;
      font-size: 8px;
      font-weight: 900;
    }

    /* Sticky columns - remove sticky for print */
    td.sticky, th.sticky { position: static !important; }

    .no-print, [class*="no-print"] { display: none !important; }

    .print-input-value, .print-select-value {
      font-weight: 700;
      color: #1a1a2e;
    }

    .print-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #dde4f5;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #999;
      font-weight: 600;
    }

    @media print {
      body { padding: 10px; }
      @page { margin: 15mm 10mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div>
      <div class="school-name">⚜ Portal JBR — José Barbosa Rodrigues</div>
      <div class="report-title">${options.title}</div>
      ${options.subtitle ? `<div class="report-subtitle">${options.subtitle}</div>` : ''}
    </div>
    <div class="print-meta">
      Impresso em: ${dateStr}<br/>Às: ${timeStr}
    </div>
  </div>

  ${options.info && options.info.length > 0 ? `
  <div class="info-row">
    ${options.info.map(i => `
      <div class="info-item">
        <span class="info-label">${i.label}</span>
        <span class="info-value">${i.value}</span>
      </div>
    `).join('')}
  </div>` : ''}

  ${clone.outerHTML}

  <div class="print-footer">
    <span>Portal do Professor JBR — Escola José Barbosa Rodrigues</span>
    <span>Documento gerado automaticamente pelo sistema</span>
  </div>

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
