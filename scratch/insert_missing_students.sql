-- ============================================================
-- INSERT 3 MISSING STUDENTS (run in Supabase SQL Editor)
-- This runs as superuser and bypasses RLS policies
-- ============================================================

-- 2º Ano B → turma_id = dfb7bcab-93ff-45c6-86f9-031cb1b417ae (currently 33 students, max número = 33)
-- 3º Ano B → turma_id = e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a (currently 27 students, max número = 27)

INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES
  (
    'LUCAS JEFERSON FLORENCIO COSTA',
    'dfb7bcab-93ff-45c6-86f9-031cb1b417ae',
    34,
    'Ativo'
  ),
  (
    'PEDRO HENRIQUE SANTOS PEREIRA',
    'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a',
    28,
    'Ativo'
  ),
  (
    'VINICIUS FRÔES DA SILVA',
    'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a',
    29,
    'Ativo'
  )
ON CONFLICT DO NOTHING
RETURNING id, nome, turma_id, aluno_numero, status;

-- ============================================================
-- VERIFY: Check total counts after insertion
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM alunos)             AS total_alunos,
  (SELECT COUNT(*) FROM chamadas)            AS total_chamadas,
  (SELECT COUNT(*) FROM notas_avaliacoes)    AS total_notas,
  (SELECT COUNT(*) FROM avaliacoes)          AS total_avaliacoes;

-- ============================================================
-- VERIFY: Check the 2 turmas specifically
-- ============================================================
SELECT t.nome AS turma, COUNT(a.id) AS total_alunos
FROM turmas t
LEFT JOIN alunos a ON a.turma_id = t.id
WHERE t.id IN (
  'dfb7bcab-93ff-45c6-86f9-031cb1b417ae',
  'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
)
GROUP BY t.id, t.nome
ORDER BY t.nome;
