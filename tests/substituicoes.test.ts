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

// 7) Configuração de vistos no modo substituto: a configuração do substituto se aplica
import { getConfigPorTurma } from '../src/utils/academicUtils';

const professorSubstituto = {
  id: 'F',
  nome: 'Francielly',
  email: 'f@escola.ms.gov.br',
  cargo: 'Professor',
  config_visto_metodo: 'ponto' as const,
  config_visto_valor_total: 3.0,
  config_turmas: {
    'turma-101': { config_visto_metodo: 'simbolico' as const, config_visto_valor_total: 4.0 },
  },
};

const titular = {
  id: 'B',
  nome: 'Bruno',
  email: 'b@escola.ms.gov.br',
  cargo: 'Professor',
  config_visto_metodo: 'gradual' as const,
  config_visto_valor_total: 2.0,
  config_turmas: {
    'turma-101': { config_visto_metodo: 'aberto' as const, config_visto_valor_total: 10.0 },
  },
};

// Quando professorDados é montado no modo substituto, o ID do titular é preservado para consultas de banco,
// mas a configuração de vistos aplicada aos alunos vem do substituto ativo:
const professorDados = {
  ...professorSubstituto,
  id: titular.id, // Grava no titular
};

// Na turma com config específica do substituto:
const configTurmaEspecifica = getConfigPorTurma(professorDados, 'turma-101');
assert.equal(configTurmaEspecifica.config_visto_metodo, 'simbolico');
assert.equal(configTurmaEspecifica.config_visto_valor_total, 4.0);

// Em outra turma sem config específica: usa a global do substituto (não a do titular!)
const configTurmaGlobal = getConfigPorTurma(professorDados, 'turma-102');
assert.equal(configTurmaGlobal.config_visto_metodo, 'ponto');
assert.equal(configTurmaGlobal.config_visto_valor_total, 3.0);

console.log('substituicoes: 7 casos ok (incluindo configuracao de vistos do substituto)');
