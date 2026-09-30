// Termo de Ajuste e Compromisso — Professor Convocado (Art. 19, § 3º, da LC 266/2019).
// Gera o HTML de 2 páginas A4 (frente e verso) na mesma formatação do formulário em papel.
// A tela mostra este HTML numa prévia e a impressão usa exatamente o mesmo HTML.

export interface DadosTermoConvocado {
  nome: string;
  rg: string;
  cpf: string;
  dataNascimento: string; // AAAA-MM-DD
  tituloEleitor: string;
  zonaEleitoral: string;
  secaoEleitoral: string;
  endereco: string;
  telefoneFixo: string;
  celular: string;
  email: string;
  formacao: string;
  horasSemanais: string;
  componente: string;
  escolaMunicipio: string;
  periodoDe: string; // AAAA-MM-DD
  periodoAte: string; // AAAA-MM-DD
  substituidoNome: string;
  substituidoMatricula: string;
  valorHora: string; // "43,32777"
  fundamentoValor: string;
  cidade: string;
  dataDocumento: string; // AAAA-MM-DD
}

export const FUNDAMENTO_VALOR_PADRAO = 'Decreto Estadual n°. 16.754, de 31 de março de 2026';

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(' e ');
}

export function numeroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const milhares = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (milhares) partes.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`);
  if (resto) partes.push(ate999(resto));
  // "mil e quinhentos", "mil e cinquenta": conector quando o resto é < 100 ou múltiplo de 100.
  return partes.length === 2 && (resto < 100 || resto % 100 === 0) ? partes.join(' e ') : partes.join(' ');
}

// "43,32777" -> "quarenta e três reais e trinta e dois centavos" (centavos truncados, como no termo).
export function valorPorExtenso(valor: string): string {
  const numero = Number(valor.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0) return '';
  const reais = Math.floor(numero + 1e-9);
  const centavos = Math.floor((numero - reais) * 100 + 1e-6);
  const partes: string[] = [];
  if (reais > 0 || centavos === 0) partes.push(`${numeroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`);
  if (centavos > 0) partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return partes.join(' e ');
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function esc(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function gerarHtmlTermoConvocado(d: DadosTermoConvocado): string {
  const extenso = valorPorExtenso(d.valorHora);
  const valorTexto = d.valorHora.trim() || '______';
  const dt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.dataDocumento);

  const linhasComponente = d.componente.trim() ? esc(d.componente.trim()).replace(/\n/g, '<br>') : '';
  const linhasEscola = d.escolaMunicipio.trim() ? esc(d.escolaMunicipio.trim()).replace(/\n/g, '<br>') : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Termo de Ajuste e Compromisso - Professor Convocado</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #e5e7eb; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; }
  .pagina { width: 210mm; height: 297mm; margin: 0 auto 6mm; padding: 12mm 16mm 10mm 18mm; background: #fff; position: relative; overflow: hidden; page-break-after: always; }
  .pagina:last-child { page-break-after: auto; margin-bottom: 0; }
  h1 { text-align: center; font-size: 11pt; font-weight: bold; text-transform: uppercase; }
  h2 { text-align: center; font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 3mm 0 3.5mm; }
  table.quadro { width: 100%; border-collapse: collapse; border: 0.3mm solid #000; }
  table.quadro td { border: 0.3mm solid #000; padding: 1mm 2mm 1.2mm; vertical-align: top; font-weight: bold; font-size: 10pt; height: 7.4mm; }
  table.quadro td .rot { font-weight: bold; }
  table.quadro td .v { font-weight: normal; margin-left: 2mm; text-transform: none; }
  .corpo { text-align: justify; line-height: 1.75; margin-top: 3.5mm; }
  .corpo p { margin-bottom: 2mm; }
  .item { display: flex; align-items: baseline; gap: 1mm; line-height: 1.7; }
  .item .lin { flex: 1; border-bottom: 0.25mm solid #000; padding: 0 1mm; min-height: 5.4mm; }
  .linha-extra { border-bottom: 0.25mm solid #000; min-height: 5.6mm; margin: 0 0 0.4mm 0; }
  .nota { position: absolute; left: 18mm; right: 16mm; bottom: 10mm; font-family: 'Times New Roman', Times, serif; font-style: italic; font-size: 9pt; line-height: 1.22; }
  .nota .traco { border-top: 0.25mm solid #000; width: 45mm; margin-bottom: 1.4mm; }
  .verso-topo { margin-top: 2mm; text-align: center; }
  .ass { text-align: center; margin-top: 12mm; }
  .ass .tr { border-top: 0.25mm solid #000; margin: 0 auto 1.5mm; width: 100mm; }
  .ass2 { display: flex; justify-content: space-between; gap: 12mm; margin-top: 12mm; text-align: center; }
  .ass2 > div { flex: 1; } .ass2 .tr { border-top: 0.25mm solid #000; margin-bottom: 1.5mm; }
  @media print {
    html, body { background: #fff; }
    @page { size: A4; margin: 0; }
    .pagina { margin: 0; }
  }
</style>
</head>
<body>

<div class="pagina">
  <h1>Termo de Ajuste e Compromisso Professor Convocado</h1>
  <h2>(Art. 19, § 3°, da LC 266/2019)</h2>

  <table class="quadro">
    <tr><td colspan="6"><span class="rot">NOME COMPLETO</span> ${d.nome.trim() ? `<span class="v">${esc(d.nome.trim())}</span>` : ''}</td></tr>
    <tr>
      <td colspan="2"><span class="rot">RG</span>${d.rg.trim() ? `<span class="v">${esc(d.rg.trim())}</span>` : ''}</td>
      <td colspan="2"><span class="rot">CPF</span>${d.cpf.trim() ? `<span class="v">${esc(d.cpf.trim())}</span>` : ''}</td>
      <td colspan="2"><span class="rot">DATA NASCIMENTO:</span> ${dataBR(d.dataNascimento) ? `<span class="v">${dataBR(d.dataNascimento)}</span>` : '<span class="rot">&nbsp;&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;/</span>'}</td>
    </tr>
    <tr>
      <td colspan="2"><span class="rot">TÍTULO ELEITORAL</span>${d.tituloEleitor.trim() ? `<span class="v">${esc(d.tituloEleitor.trim())}</span>` : ''}</td>
      <td colspan="2"><span class="rot">ZONA ELEITORAL</span>${d.zonaEleitoral.trim() ? `<span class="v">${esc(d.zonaEleitoral.trim())}</span>` : ''}</td>
      <td colspan="2"><span class="rot">SEÇÃO</span>${d.secaoEleitoral.trim() ? `<span class="v">${esc(d.secaoEleitoral.trim())}</span>` : ''}</td>
    </tr>
    <tr><td colspan="6"><span class="rot">ENDEREÇO RESIDENCIAL</span>${d.endereco.trim() ? `<span class="v">${esc(d.endereco.trim())}</span>` : ''}</td></tr>
    <tr>
      <td colspan="3"><span class="rot">TELEFONE FIXO</span>${d.telefoneFixo.trim() ? `<span class="v">${esc(d.telefoneFixo.trim())}</span>` : ''}</td>
      <td colspan="3"><span class="rot">CEL.</span>${d.celular.trim() ? `<span class="v">${esc(d.celular.trim())}</span>` : ''}</td>
    </tr>
    <tr><td colspan="6"><span class="rot">E-MAIL</span>${d.email.trim() ? `<span class="v">${esc(d.email.trim())}</span>` : ''}</td></tr>
    <tr><td colspan="6"><span class="rot">FORMAÇÃO/GRADUAÇÃO: ESPECIALIZAÇÃO – TABELA A</span>${d.formacao.trim() ? `<div class="v" style="margin-left:0;margin-top:1mm">${esc(d.formacao.trim())}</div>` : ''}</td></tr>
  </table>

  <div class="corpo">
    <p>EU, acima identificado (a), manifesto concordância em exercer a função DOCENTE TEMPORÁRIO na Rede Estadual de Ensino – REE/MS sob a forma de CONVOCAÇÃO, nos termos previstos na Lei Complementar Estadual n°. 87, de 31 de janeiro de 2000, com a redação dada pela Lei Complementar Estadual n°. 266, de 11 de julho de 2019, conforme os seguintes ajustes:</p>

    <div class="item"><span>1) Quantidade de horas semanais:</span><span class="lin">${esc(d.horasSemanais.trim())}</span></div>
    <div class="item"><span>2) Componente curricular/disciplina/projeto/programa:</span><span class="lin">${linhasComponente.split('<br>')[0] ?? ''}</span></div>
    <div class="linha-extra">${linhasComponente.split('<br>')[1] ?? ''}</div>
    <div class="linha-extra">${linhasComponente.split('<br>').slice(2).join(' ')}</div>
    <div class="item" style="margin-top:1.5mm"><span>3) Escola/município onde prestará os serviços:</span><span class="lin">${linhasEscola.split('<br>')[0] ?? ''}</span></div>
    <div class="linha-extra">${linhasEscola.split('<br>')[1] ?? ''}</div>
    <div class="linha-extra">${linhasEscola.split('<br>').slice(2).join(' ')}</div>
    <div class="item" style="margin-top:2mm"><span>4) Período: de</span><span class="lin" style="flex:1.6">${esc(dataBR(d.periodoDe))}</span><span>a</span><span class="lin" style="flex:1.6">${esc(dataBR(d.periodoAte))}</span></div>
    <div class="item"><span>5) Em substituição ao Professor(a) efetivo(a):</span><span class="lin">${esc(d.substituidoNome.trim())}</span></div>
    <div class="item"><span class="lin" style="flex:1.3">&nbsp;</span><span>Matrícula:</span><span class="lin">${esc(d.substituidoMatricula.trim())}</span></div>
    <p style="margin-top:1mm">6) Remuneração: Valor hora-aula de R$ ${esc(valorTexto)}${extenso ? ` (${esc(extenso)})` : ''}, conforme estabelece o ${esc(d.fundamentoValor.trim() || FUNDAMENTO_VALOR_PADRAO)}.</p>

    <p style="margin-top:3.5mm">Declaro estar apto (a) e preencher todos os requisitos exigidos para o desempenho da função Docente, comprometendo-me a cumprí-la com dedicação e zelo, bem como estou ciente de que ficarei submetido (a) aos deveres e proibições previstos no Estatuto dos Profissionais da Educação Básica e, subsidiariamente, no Estatuto dos Servidores Públicos Civis do Estado.</p>
    <p>Declaro, ainda, estar ciente da temporariedade do vínculo com a Administração Pública, vinculada à necessidade excepcional e transitória da Administração Pública acima especificada, bem como que que tenho assegurados os direitos previstos no art. 22 da LC n° 87/2000, com a redação dada pela LC n° 266/2019<sup>1</sup>.</p>
  </div>

  <div class="nota">
    <div class="traco"></div>
    <div><sup>1</sup> Art. 22. O profissional convocado fará jus, além da remuneração prevista no art. 17-B desta Lei Complementar, aos seguintes benefícios:<br>
    I - férias, abono de férias e gratificação natalina;<br>
    II - licença para tratamento de saúde, pelo regime jurídico previdenciário correspondente, e limitada ao período da convocação;</div>
  </div>
</div>

<div class="pagina">
  <div class="verso-topo">${d.cidade.trim() ? esc(d.cidade.trim()) : '______________________'}, MS, ${dt ? dt[3] : '______'} de ${dt ? MESES[Number(dt[2]) - 1] : '______________'} de ${dt ? dt[1] : '________'}.</div>

  <div class="ass"><div class="tr"></div>Assinatura do (a) Docente Temporário (a)</div>

  <div class="ass2">
    <div><div class="tr"></div>Assinatura do Diretor (a)</div>
    <div><div class="tr"></div>Assinatura do Secretário (a)</div>
  </div>

  <div class="nota">
    <div class="traco"></div>
    <div>III - incentivo financeiro pelo exercício em local de difícil acesso, em ensino noturno e em unidades prisionais ou de internação, conforme percentuais previsto no art. 54 desta Lei Complementar, incidentes sobre o valor constante da tabela própria e os parâmetros previstos no art. 17-B desta Lei Complementar, observado o nível de formação profissional correspondente;<br>
    IV - estabilidade à gestante, até 5 (cinco) meses após o parto.<br>
    VI - licença maternidade;<br>
    VII - licença paternidade;<br>
    VIII - ausentar-se do serviço por até 2 (dois) dias por motivo de falecimento do cônjuge, do companheiro, dos pais, da madrasta ou do padrasto, dos filhos ou dos enteados e dos irmãos;<br>
    IX - licença núpcias de 3 (três) dias.</div>
  </div>
</div>

</body>
</html>`;
}
