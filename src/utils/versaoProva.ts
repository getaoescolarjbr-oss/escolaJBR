import type { Question } from '../types/bancoQuestoes';
import { normalizarTipoQuestao } from '../types/bancoQuestoes';
import { LETRAS_BOLHA, type ItemCartao } from './cartaoResposta';

// Aplica uma versão (ordem das questões + permutação das alternativas, vindas de
// prova_versoes) sobre as questões do banco, produzindo a prova como ela sai no papel
// para aquele aluno.
//
// A permutação é aplicada aqui e SÓ aqui, na impressão. A correção não desfaz isso no
// navegador: manda a bolha lida para rpc_corrigir_omr e o banco traduz, usando o mesmo
// registro de prova_versoes. Se os dois lados embaralhassem por conta própria, um
// resorteio invalidaria as folhas já impressas em silêncio.

/**
 * Questões na ordem da versão, com as alternativas permutadas e RENUMERADAS: a
 * alternativa que a versão manda para a primeira posição vira "A" na folha, seja qual
 * for a letra dela no banco.
 *
 * `correct_letter` é deixada intacta de propósito — ela é a letra do banco, e nenhuma
 * tela de impressão a usa. Reescrevê-la aqui criaria uma segunda verdade sobre o
 * gabarito, competindo com rpc_gabarito_versao.
 */
export function aplicarVersao(
  questoesPorId: Map<string, Question>,
  ordem: string[],
  mapa: Record<string, string[]> | null | undefined
): Question[] {
  const permutacoes = mapa ?? {};

  return ordem
    .map((id) => questoesPorId.get(id))
    .filter((q): q is Question => !!q)
    .map((q) => {
      const permutacao = permutacoes[q.id];
      if (!permutacao || permutacao.length === 0) return q;

      const porLetra = new Map(q.alternatives.map((a) => [a.letter, a]));
      const alternatives = permutacao
        .map((letraOriginal, i) => {
          const alt = porLetra.get(letraOriginal);
          return alt ? { ...alt, letter: LETRAS_BOLHA[i] } : null;
        })
        .filter((a): a is NonNullable<typeof a> => !!a);

      // Permutação incompleta (questão editada no banco depois do sorteio): imprime a
      // ordem original. Meia permutação corrigiria errado — todas as respostas daquela
      // questão sairiam deslocadas —, e a versão A, não embaralhada, seria a única
      // certa. Melhor perder o embaralhamento de uma questão do que a correção dela.
      if (alternatives.length !== q.alternatives.length) return q;

      return { ...q, alternatives };
    });
}

/**
 * As linhas do cartão de uma prova já ordenada pela versão. Casa 1 para 1 com o que
 * linhas_cartao_versao() devolve no banco: só objetiva com alternativa entra, e o
 * número impresso é o da questão na prova, não o da linha.
 */
export function itensCartaoDaVersao(questoes: Question[]): ItemCartao[] {
  return questoes
    .map((q, i) => ({ q, numeroNaProva: i + 1 }))
    .filter(({ q }) => normalizarTipoQuestao(q.tipo) === 'OBJETIVA' && q.alternatives.length > 0)
    .map(({ q, numeroNaProva }) => ({ numeroNaProva, qtdAlternativas: q.alternatives.length }));
}
