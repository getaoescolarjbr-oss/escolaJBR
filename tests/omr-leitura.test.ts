// Teste do leitor óptico, sem câmera e sem navegador.
//
//   npx tsx tests/omr-leitura.test.ts
//
// Sintetiza a imagem de um cartão preenchido — as mesmas marcas de canto e as mesmas
// bolhas que a folha impressa tem, nas posições que calcularGeometria() define — e
// verifica se lerCartao() recupera exatamente o que foi "marcado".
//
// A imagem é desenhada ATRAVÉS DE UMA HOMOGRAFIA arbitrária: o cartão aparece torto,
// em perspectiva e deslocado, como numa foto de celular segurado com uma mão só. Um
// teste com a folha perfeitamente de frente passaria mesmo se a homografia do leitor
// estivesse errada, e é justamente ela a parte difícil.

import { calcularGeometria, BOLHA_MM, MARCA_MM, type ItemCartao } from '../src/utils/cartaoResposta';
import { lerCartao } from '../src/lib/omr';

const LARG = 1000;
const ALT = 750;

type Ponto = { x: number; y: number };

/** Mesma montagem do DLT de lib/omr.ts, aqui para gerar a imagem em vez de interpretá-la. */
function homografia(origem: Ponto[], destino: Ponto[]): number[] {
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
    [A[col], A[pivo]] = [A[pivo], A[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }
  return [...A.map((l, i) => l[n] / l[i]), 1];
}

function projetar(h: number[], x: number, y: number): Ponto {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

class Tela {
  dados = new Uint8ClampedArray(LARG * ALT * 4);

  /**
   * `sombra` escurece progressivamente da esquerda para a direita, imitando a sombra da
   * própria mão que segura o celular. É o caso que separa um limiar adaptativo de um
   * limiar global: com sombra, o global transforma metade da folha em preto sólido.
   */
  constructor(fundo = 245, sombra = 0) {
    for (let p = 0, i = 0; p < LARG * ALT; p++, i += 4) {
      const x = p % LARG;
      // Ruído leve: papel real não é uma chapa de cinza uniforme, e um fundo perfeito
      // deixaria o limiar adaptativo com uma folga que a foto de verdade não dá.
      const v = fundo * (1 - (sombra * x) / LARG) + Math.round((Math.random() - 0.5) * 8);
      this.dados[i] = this.dados[i + 1] = this.dados[i + 2] = v;
      this.dados[i + 3] = 255;
    }
  }

  ponto(x: number, y: number, tom: number) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= LARG || py >= ALT) return;
    const i = (py * LARG + px) * 4;
    this.dados[i] = this.dados[i + 1] = this.dados[i + 2] = tom;
  }

  /** Preenche um quadrado do papel (mm) projetado na imagem. */
  quadrado(h: number[], cx: number, cy: number, lado: number, tom: number) {
    const passo = 0.08;
    for (let dy = -lado / 2; dy <= lado / 2; dy += passo) {
      for (let dx = -lado / 2; dx <= lado / 2; dx += passo) {
        const p = projetar(h, cx + dx, cy + dy);
        this.ponto(p.x, p.y, tom);
      }
    }
  }

  /** Anel (bolha vazia) ou disco (bolha marcada), em mm de papel. */
  circulo(h: number[], cx: number, cy: number, raio: number, tom: number, preenchido: boolean) {
    const passo = 0.06;
    for (let dy = -raio; dy <= raio; dy += passo) {
      for (let dx = -raio; dx <= raio; dx += passo) {
        const d = Math.hypot(dx, dy);
        if (d > raio) continue;
        if (!preenchido && d < raio - 0.25) continue; // só a borda impressa
        const p = projetar(h, cx + dx, cy + dy);
        this.ponto(p.x, p.y, tom);
      }
    }
  }

  imageData() {
    return { data: this.dados, width: LARG, height: ALT, colorSpace: 'srgb' } as unknown as ImageData;
  }
}

interface OpcoesDesenho {
  /** 0 = sem sombra; 0.45 = canto direito com 45% menos luz. */
  sombra?: number;
  /** Tom da marcação do aluno: 70 = caneta, 150 = lápis passado de leve. */
  tomMarcacao?: number;
}

function desenharCartao(itens: ItemCartao[], respostas: string[], cantos: Ponto[], op: OpcoesDesenho = {}) {
  const geom = calcularGeometria(itens);
  const h = homografia(
    [
      { x: 0, y: 0 },
      { x: geom.larguraMm, y: 0 },
      { x: geom.larguraMm, y: geom.alturaMm },
      { x: 0, y: geom.alturaMm },
    ],
    cantos
  );

  const tela = new Tela(245, op.sombra ?? 0);
  for (const m of geom.marcas) tela.quadrado(h, m.x, m.y, MARCA_MM, 20);

  for (const linha of geom.linhas) {
    const marcada = respostas[linha.linha - 1];
    for (const bolha of linha.bolhas) {
      const pintada = marcada === bolha.letra || marcada === '*';
      // Marcação de caneta não chega a preto: 70 é um cinza escuro realista.
      tela.circulo(h, bolha.x, bolha.y, BOLHA_MM / 2, pintada ? (op.tomMarcacao ?? 70) : 30, pintada);
    }
  }
  return { tela, geom };
}

// ------------------------------------------------------------------------------------

let falhas = 0;

function checar(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  OK  ' : ' FALHA'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas++;
}

/**
 * Enquadramento realista: o cartão ocupa `ocupacao` do quadro RESPEITANDO A PROPORÇÃO
 * dele, e só então recebe rotação e perspectiva. Enquadrar um cartão de 121x98mm num
 * retângulo largo e baixo, como um teste ingênuo faria, esmagaria as marcas quadradas a
 * ponto de nenhum detector honesto reconhecê-las — e o teste estaria reprovando o
 * leitor por um defeito do próprio teste.
 */
function enquadrar(
  larguraMm: number,
  alturaMm: number,
  opcoes: { ocupacao?: number; giroGraus?: number; inclinacao?: number } = {}
): Ponto[] {
  const { ocupacao = 0.82, giroGraus = 0, inclinacao = 0 } = opcoes;

  // A escala tem de considerar o GIRO: dimensionar pelo retângulo sem girar e só depois
  // rodar joga cantos para fora do quadro, e aí o teste estaria medindo "o que acontece
  // com a folha cortada" achando que mede rotação. Esse caso tem cenário próprio.
  const rad0 = (giroGraus * Math.PI) / 180;
  const extX = Math.abs(larguraMm * Math.cos(rad0)) + Math.abs(alturaMm * Math.sin(rad0));
  const extY = Math.abs(larguraMm * Math.sin(rad0)) + Math.abs(alturaMm * Math.cos(rad0));
  const escala = Math.min((LARG * ocupacao) / extX, (ALT * ocupacao) / extY);
  const w = (larguraMm * escala) / 2;
  const h = (alturaMm * escala) / 2;
  const cx = LARG / 2;
  const cy = ALT / 2;
  const rad = (giroGraus * Math.PI) / 180;

  // Cantos em torno da origem, girados e depois deslocados para o centro do quadro.
  // A inclinação encolhe o lado de cima, que é o efeito de fotografar de baixo para cima.
  return [
    [-w, -h * (1 - inclinacao)],
    [w * (1 - inclinacao), -h * (1 - inclinacao)],
    [w, h],
    [-w, h],
  ].map(([x, y]) => ({
    x: cx + x * Math.cos(rad) - y * Math.sin(rad),
    y: cy + x * Math.sin(rad) + y * Math.cos(rad),
  }));
}

function cenario(
  nome: string,
  itens: ItemCartao[],
  respostas: string[],
  opcoes: { ocupacao?: number; giroGraus?: number; inclinacao?: number } & OpcoesDesenho = {}
) {
  const geomRef = calcularGeometria(itens);
  const cantos = enquadrar(geomRef.larguraMm, geomRef.alturaMm, opcoes);
  const { tela, geom } = desenharCartao(itens, respostas, cantos, opcoes);
  const lida = lerCartao(tela.imageData(), geom);

  const dim = `${geom.larguraMm.toFixed(0)}x${geom.alturaMm.toFixed(0)}mm, ${geom.blocos} bloco(s)`;

  if (!lida) {
    checar(nome, false, `as quatro marcas não foram localizadas (${dim})`);
    return;
  }

  const esperado = respostas.join('|');
  const obtido = lida.marcacoes.join('|');
  checar(
    nome,
    esperado === obtido,
    esperado === obtido
      ? `${dim}, confiança ${lida.confianca.toFixed(2)}`
      : `\n         esperado: ${esperado}\n         obtido:   ${obtido}`
  );
}

function respostasDe(itens: ItemCartao[]): string[] {
  return itens.map((it, i) => {
    if (i === 5) return '';   // deixada em branco
    if (i === 11) return '*'; // duas bolhas marcadas
    return 'ABCDE'[i % it.qtdAlternativas];
  });
}

const itens20: ItemCartao[] = Array.from({ length: 20 }, (_, i) => ({
  numeroNaProva: i + 1,
  qtdAlternativas: i % 4 === 3 ? 4 : 5,
}));
const respostas20 = respostasDe(itens20);

const itens10: ItemCartao[] = Array.from({ length: 10 }, (_, i) => ({ numeroNaProva: i + 1, qtdAlternativas: 5 }));
const itens45: ItemCartao[] = Array.from({ length: 45 }, (_, i) => ({ numeroNaProva: i + 1, qtdAlternativas: 5 }));

console.log('\nLeitura óptica do cartão-resposta\n');

cenario('20 questões, folha de frente', itens20, respostas20);
cenario('20 questões, girada 7 graus', itens20, respostas20, { giroGraus: 7 });
cenario('20 questões, girada -12 graus', itens20, respostas20, { giroGraus: -12 });
cenario('20 questões, celular inclinado', itens20, respostas20, { inclinacao: 0.16 });
cenario('20 questões, inclinado e girado', itens20, respostas20, { giroGraus: 9, inclinacao: 0.13 });
cenario('20 questões, câmera longe (50% do quadro)', itens20, respostas20, { ocupacao: 0.5 });
cenario('10 questões (1 bloco)', itens10, respostasDe(itens10), { giroGraus: 5 });
cenario('45 questões (3 blocos)', itens45, respostasDe(itens45), { giroGraus: -6, inclinacao: 0.1 });
cenario('20 questões, girada 20 graus', itens20, respostas20, { giroGraus: 20 });
cenario('sombra da mão sobre a folha', itens20, respostas20, { sombra: 0.45, giroGraus: 5 });
cenario('marcação fraca a lápis', itens20, respostas20, { tomMarcacao: 150 });
cenario('lápis fraco com sombra e giro', itens20, respostas20, { tomMarcacao: 145, sombra: 0.35, giroGraus: -8 });

// Um canto fora do quadro tem que virar "não li", nunca uma leitura completa e errada:
// sem esta garantia, uma folha mal enquadrada gravaria nota de um cartão que ninguém
// leu de fato.
{
  const geomRef = calcularGeometria(itens20);
  const esc = Math.min((LARG * 0.82) / geomRef.larguraMm, (ALT * 0.82) / geomRef.alturaMm);
  const w = (geomRef.larguraMm * esc) / 2;
  const h = (geomRef.alturaMm * esc) / 2;
  const rad = (-12 * Math.PI) / 180;
  const cantos = ([[-w, -h], [w, -h], [w, h], [-w, h]] as [number, number][]).map(([x, y]) => ({
    x: LARG / 2 + x * Math.cos(rad) - y * Math.sin(rad),
    y: ALT / 2 + x * Math.sin(rad) + y * Math.cos(rad),
  }));
  const { tela, geom } = desenharCartao(itens20, respostas20, cantos);
  const lida = lerCartao(tela.imageData(), geom);
  checar(
    'cartão com cantos cortados é recusado',
    lida === null,
    lida === null ? 'nenhuma leitura, como esperado' : `leu (errado): ${lida.marcacoes.join('|')}`
  );
}

console.log(falhas === 0 ? '\nTodos os cenários passaram.\n' : `\n${falhas} cenário(s) falharam.\n`);
process.exitCode = falhas === 0 ? 0 : 1;
