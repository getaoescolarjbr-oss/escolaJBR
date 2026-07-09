// Parser mínimo de CSV (sem dependência nova): lida com aspas e vírgulas dentro de
// campos citados ("a, b"), aspas escapadas (""), e quebras de linha \r\n ou \n. A
// primeira linha é o cabeçalho, cada linha seguinte vira um objeto { coluna: valor }.
export function parseCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroDeAspas = false;

  const textoLimpo = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < textoLimpo.length; i++) {
    const char = textoLimpo[i];
    const proximo = textoLimpo[i + 1];

    if (dentroDeAspas) {
      if (char === '"' && proximo === '"') { campo += '"'; i++; }
      else if (char === '"') { dentroDeAspas = false; }
      else { campo += char; }
    } else if (char === '"') {
      dentroDeAspas = true;
    } else if (char === ',') {
      linha.push(campo.trim());
      campo = '';
    } else if (char === '\n') {
      linha.push(campo.trim());
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += char;
    }
  }
  if (campo !== '' || linha.length > 0) { linha.push(campo.trim()); linhas.push(linha); }

  const linhasNaoVazias = linhas.filter((l) => l.length > 1 || (l.length === 1 && l[0] !== ''));
  if (linhasNaoVazias.length === 0) return [];

  const cabecalho = linhasNaoVazias[0].map((h) => h.trim());
  return linhasNaoVazias.slice(1).map((linha) => {
    const obj: Record<string, string> = {};
    cabecalho.forEach((coluna, idx) => { obj[coluna] = linha[idx] ?? ''; });
    return obj;
  });
}
