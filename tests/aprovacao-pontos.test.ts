import assert from 'node:assert/strict';
import { alunosDaTurma, resumoParcialAno, resumoParcialPorTurma, situacaoDoAluno } from '../src/components/gestaoEscolar/indicadores/notasCalculo';
import type { DadosNotas } from '../src/components/gestaoEscolar/indicadores/notasCalculo';

// Turma T com 4 alunos e 2 disciplinas (mat, por). Notas por bimestre [b1,b2,b3,b4]; null = não lançado.
const dados: DadosNotas = {
  turmas: [{ id: 'T', nome: '1º Ano A' }],
  disciplinas: [{ id: 'mat', nome: 'Matemática' }, { id: 'por', nome: 'Português' }],
  alunos: [
    { id: 'a', nome: 'Ana', aluno_numero: 1, turma_id: 'T' },
    { id: 'b', nome: 'Beto', aluno_numero: 2, turma_id: 'T' },
    { id: 'c', nome: 'Caio', aluno_numero: 3, turma_id: 'T' },
    { id: 'd', nome: 'Dani', aluno_numero: 4, turma_id: 'T' },
  ],
  notas: {
    // Ana: 8+8+7,5 = 23,5 em mat e 8+8+8 = 24 em por -> chegou (23,5 já aprova)
    a: { mat: [8, 8, 7.5, null], por: [8, 8, 8, null] },
    // Beto: mat 23 (falta 0,5 para 23,5) -> ainda NÃO aprovado, mesmo tendo média boa
    b: { mat: [8, 8, 7, null], por: [8, 8, 8, null] },
    // Caio: média 7 nos 2 bimestres (soma 14): a regra antiga (média >= 6) aprovava, a nova não
    c: { mat: [7, 7, null, null], por: [7, 7, null, null] },
    // Dani: sem nenhuma nota
    d: {},
  },
};

// 1) Só quem soma >= 23,5 em TODAS as disciplinas é aprovado
let r = resumoParcialAno(dados);
assert.deepEqual({ ap: r.acimaDaMedia, falta: r.abaixoDaMedia, sem: r.semNotas, total: r.total }, { ap: 1, falta: 2, sem: 1, total: 4 });

// 2) Lista da turma: faltam aprovar primeiro (quem tem mais disciplinas abaixo no topo: Caio 2, Beto 1),
//    aprovados depois, sem nota por último
const lista = alunosDaTurma(dados, 'T', 2);
assert.deepEqual(lista.map((l) => [l.aluno.nome, l.situacao]), [['Caio', 'abaixo'], ['Beto', 'abaixo'], ['Ana', 'acima'], ['Dani', 'sem']]);

// 3) Beto: mat soma 23 -> faltam 0,5 ponto; por já aprovada (24)
let s = situacaoDoAluno(dados, 'b', 2);
assert.equal(s.abaixo.length, 1);
assert.equal(s.abaixo[0].nome, 'Matemática');
assert.equal(s.abaixo[0].soma, 23);
assert.equal(s.abaixo[0].faltaPontos, 0.5);
assert.equal(s.abaixo[0].alcancavel, true);
assert.equal(s.aprovadas.map((d) => d.nome).join(), 'Português');

// 4) Caio (2 bimestres encerrados): soma 14 -> faltam 9,5; restam 2 bimestres -> 4,75 por bimestre; alcançável (máx. 20)
s = situacaoDoAluno(dados, 'c', 2);
const mat = s.abaixo.find((d) => d.disciplinaId === 'mat')!;
assert.equal(mat.faltaPontos, 9.5);
assert.equal(mat.restantes, 2);
assert.equal(mat.extraPorBimestre, 4.75);
assert.equal(mat.alcancavel, true);

// 5) Inalcançável sem exame: soma 5 com só 1 bimestre restante (máx. +10 = 15 < 23,5)
const fraco: DadosNotas = { ...dados, notas: { a: { mat: [2, 1, 1, 1] } } };
const f = situacaoDoAluno(fraco, 'a', 3).abaixo[0];
assert.equal(f.soma, 5);
assert.equal(f.restantes, 1);
assert.equal(f.alcancavel, false);

// 6) Sem bimestre restante: só resta o exame
assert.equal(situacaoDoAluno(fraco, 'a', 4).abaixo[0].extraPorBimestre, null);

// 7) Bimestre em andamento já conta os pontos que o aluno tem (o parcial do 3º entra na soma)
const parcial: DadosNotas = { ...dados, notas: { a: { mat: [8, 8, 7.5, null] } } };
assert.equal(situacaoDoAluno(parcial, 'a', 2).aprovadas.length, 1);

// 8) Por turma: mesma contagem
const porTurma = resumoParcialPorTurma(dados);
assert.equal(porTurma.length, 1);
assert.equal(porTurma[0].resumo.acimaDaMedia, 1);
assert.equal(porTurma[0].resumo.abaixoDaMedia, 2);

console.log('aprovacao-pontos: 8 grupos de casos ok');
