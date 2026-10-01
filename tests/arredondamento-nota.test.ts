import assert from 'node:assert/strict';
import { arredondarNotaMS, getCorGradiente } from '../src/utils/academicUtils';

// Regra de arredondamento normal (sem estourar o teto) continua igual.
assert.equal(arredondarNotaMS(7.35), 7.5);
assert.equal(arredondarNotaMS(7.2), 7.0);
assert.equal(arredondarNotaMS(7.85), 8.0);
assert.equal(arredondarNotaMS(7.6), 7.5);

// Teto de 10: o professor pode cadastrar avaliações cuja soma passe de 10 (ex.: várias
// provas de peso alto), mas a média final nunca deve ultrapassar o máximo da disciplina.
assert.equal(arredondarNotaMS(10), 10);
assert.equal(arredondarNotaMS(10.5), 10);
assert.equal(arredondarNotaMS(12), 10);
assert.equal(arredondarNotaMS(9.85), 10); // arredondaria para 10 mesmo sem o teto — confirma que não "estoura" pra 10.5

// Piso de 0 (defensivo — nota não deveria ser negativa, mas nunca deve virar número negativo exibido).
assert.equal(arredondarNotaMS(-1), 0);

// A cor tem que bater com o número exibido (já arredondado), não com o somatório bruto —
// 5,85 é EXIBIDO como 6,0 (arredondado pra cima), então a cor tem que ser de aprovado (verde),
// não de reprovado (âmbar), mesmo a soma bruta sendo < 6.
const corAmber = '#f59e0b';
const corGreen = '#4ade80';
assert.equal(getCorGradiente(5.85, 'dark'), corGreen);
assert.notEqual(getCorGradiente(5.85, 'dark'), corAmber);
assert.equal(getCorGradiente(5.7, 'dark'), corAmber); // arredonda pra 5.5, continua reprovado
assert.equal(getCorGradiente(5.0, 'dark'), corAmber);

console.log('arredondamento-nota: 13 casos ok (teto de 10, piso de 0 e cor usa o valor arredondado)');
