import assert from 'node:assert/strict';
import { aplicarSubstituicoes } from '../src/utils/substituicoes';
import type { EspelhoSubstituicao } from '../src/utils/substituicoes';

// Substituição: Francielly (F) substitui Bruno (B) em Física (fis).
const esp: EspelhoSubstituicao[] = [{ substituto_id: 'F', substituto_nome: 'Francielly', titular_id: 'B', titular_nome: 'Bruno', disciplina_id: 'fis' }];
const item = (professor_id: string, professor_nome: string, disciplina_id: string) => ({ professor_id, professor_nome, disciplina_id });

// 1) sem substituição: a lista não muda
const base = [item('B', 'Bruno', 'fis'), item('X', 'Xavier', 'qui')];
assert.deepEqual(aplicarSubstituicoes(base, []), base);

// 2) titular some e a substituta entra com o rótulo (substituta não estava na lista)
let r = aplicarSubstituicoes(base, esp);
assert.equal(r.length, 2);
assert.ok(!r.some((i) => i.professor_id === 'B'), 'titular deve sair');
assert.equal(r.find((i) => i.professor_id === 'F')?.professor_nome, 'Francielly (substituindo Bruno)');
assert.equal(r.find((i) => i.professor_id === 'F')?.disciplina_id, 'fis');

// 3) substituta já estava na lista (vem das alocações espelho): não duplica e ganha o rótulo
r = aplicarSubstituicoes([item('B', 'Bruno', 'fis'), item('F', 'Francielly', 'fis')], esp);
assert.equal(r.length, 1);
assert.equal(r[0].professor_id, 'F');
assert.equal(r[0].professor_nome, 'Francielly (substituindo Bruno)');

// 4) "manter": quem já tem cota salva continua na lista (edição não pode perder a cota)
r = aplicarSubstituicoes([item('B', 'Bruno', 'fis'), item('F', 'Francielly', 'fis')], esp, new Set(['B|fis']));
assert.deepEqual(r.map((i) => i.professor_id).sort(), ['B', 'F']);
assert.equal(r.find((i) => i.professor_id === 'B')?.professor_nome, 'Bruno');

// 5) outra disciplina do titular não é afetada
r = aplicarSubstituicoes([item('B', 'Bruno', 'mat')], esp);
assert.deepEqual(r, [item('B', 'Bruno', 'mat')]);

// 6) campos extras do item são preservados
r = aplicarSubstituicoes([{ ...item('B', 'Bruno', 'fis'), disciplina_nome: 'Física', area: 'N' }], esp);
assert.equal((r[0] as { disciplina_nome: string }).disciplina_nome, 'Física');

console.log('substituicoes: 6 casos ok');
