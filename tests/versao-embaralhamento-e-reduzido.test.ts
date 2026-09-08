import { aplicarVersao, itensCartaoDaVersao } from '../src/utils/versaoProva';
import type { Question } from '../src/types/bancoQuestoes';

console.log('\n--- TESTES DE EMBARALHAMENTO E INTEGRIDADE DE VERSÃO ---\n');

let falhas = 0;
function checar(nome: string, condicao: boolean, extra = '') {
  console.log(`${condicao ? '  OK  ' : ' FALHA'} ${nome}${extra ? ` — ${extra}` : ''}`);
  if (!condicao) falhas++;
}

// Criar 5 questões simuladas
const questoesMock: Question[] = [
  {
    id: 'q1',
    title: 'Questão 1',
    statement: 'Enunciado 1',
    discipline: 'Biologia',
    year: 2026,
    tipo: 'OBJETIVA',
    alternatives: [
      { letter: 'A', text: 'Alt A', is_correct: true },
      { letter: 'B', text: 'Alt B', is_correct: false },
      { letter: 'C', text: 'Alt C', is_correct: false },
      { letter: 'D', text: 'Alt D', is_correct: false },
    ],
  },
  {
    id: 'q2',
    title: 'Questão 2',
    statement: 'Enunciado 2',
    discipline: 'Física',
    year: 2026,
    tipo: 'OBJETIVA',
    alternatives: [
      { letter: 'A', text: 'Alt A', is_correct: false },
      { letter: 'B', text: 'Alt B', is_correct: true },
    ],
  },
  {
    id: 'q3',
    title: 'Questão 3',
    statement: 'Enunciado 3',
    discipline: 'Química',
    year: 2026,
    tipo: 'OBJETIVA',
    alternatives: [
      { letter: 'A', text: 'Alt A', is_correct: false },
      { letter: 'B', text: 'Alt B', is_correct: false },
      { letter: 'C', text: 'Alt C', is_correct: true },
    ],
  },
  {
    id: 'q4',
    title: 'Questão 4 (adicionada depois)',
    statement: 'Enunciado 4',
    discipline: 'Química',
    year: 2026,
    tipo: 'OBJETIVA',
    alternatives: [
      { letter: 'A', text: 'Alt A', is_correct: true },
      { letter: 'B', text: 'Alt B', is_correct: false },
    ],
  },
  {
    id: 'q5',
    title: 'Questão 5 (adicionada depois)',
    statement: 'Enunciado 5',
    discipline: 'Biologia',
    year: 2026,
    tipo: 'OBJETIVA',
    alternatives: [
      { letter: 'A', text: 'Alt A', is_correct: false },
      { letter: 'B', text: 'Alt B', is_correct: true },
    ],
  },
];

const mapaQuestoes = new Map<string, Question>(questoesMock.map((q) => [q.id, q]));

// Cenário 1: Ordem sorteada com IDs repetidos (ex: q2 duplicada)
const ordemComDuplicata = ['q3', 'q1', 'q2', 'q1', 'q2'];
const resultado1 = aplicarVersao(mapaQuestoes, ordemComDuplicata, {});
checar(
  'Remove questões duplicadas da ordem',
  resultado1.filter((q) => q.id === 'q1').length === 1 && resultado1.filter((q) => q.id === 'q2').length === 1,
  `q1 count=${resultado1.filter((q) => q.id === 'q1').length}, q2 count=${resultado1.filter((q) => q.id === 'q2').length}`
);

// Cenário 2: Prova que ganhou questões depois do sorteio da versão (q4 e q5 não estavam na versão)
const ordemAntiga = ['q2', 'q1', 'q3']; // Faltam q4 e q5
const resultado2 = aplicarVersao(mapaQuestoes, ordemAntiga, {});
checar(
  'Não deixa faltar nenhuma questão na prova (inclui as adicionadas depois)',
  resultado2.length === 5 && resultado2.some((q) => q.id === 'q4') && resultado2.some((q) => q.id === 'q5'),
  `total esperado 5, obtido ${resultado2.length}`
);

// Cenário 3: Permutação de alternativas
const mapaAlternativas = {
  q1: ['D', 'C', 'B', 'A'],
};
const resultado3 = aplicarVersao(mapaQuestoes, ['q1'], mapaAlternativas);
checar(
  'Permuta e renumera alternativas perfeitamente',
  resultado3[0].alternatives[0].text === 'Alt D' && resultado3[0].alternatives[0].letter === 'A',
  `primeira alternativa virou ${resultado3[0].alternatives[0].letter}: ${resultado3[0].alternatives[0].text}`
);

// Cenário 4: Itens do cartão da versão
const itensCartao = itensCartaoDaVersao(resultado2);
checar(
  'Gera os itens do cartão com numeração contínua 1 a N',
  itensCartao.length === 5 && itensCartao[4].numeroNaProva === 5,
  `total itens=${itensCartao.length}`
);

if (falhas > 0) {
  console.error(`\n${falhas} falha(s) encontrada(s).`);
  process.exit(1);
} else {
  console.log('\nTodos os testes passaram com sucesso!\n');
}
