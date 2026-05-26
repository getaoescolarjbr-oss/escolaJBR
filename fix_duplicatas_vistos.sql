-- =====================================================================
-- MIGRATION: Limpar duplicatas e proteger vistos_v2
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================================

-- PASSO 1: Ver quantas duplicatas existem (só para diagnóstico)
SELECT atividade_id, aluno_id, COUNT(*) as total
FROM vistos_v2
GROUP BY atividade_id, aluno_id
HAVING COUNT(*) > 1
ORDER BY total DESC;

-- PASSO 2: Remover duplicatas, mantendo apenas o registro mais recente
--          (se não há coluna created_at, mantém o de maior id)
DELETE FROM vistos_v2
WHERE id NOT IN (
  SELECT DISTINCT ON (atividade_id, aluno_id) id
  FROM vistos_v2
  ORDER BY atividade_id, aluno_id, id DESC
);

-- PASSO 3: Adicionar constraint UNIQUE para impedir duplicatas futuras
--          (ON CONFLICT DO UPDATE fará upsert seguro daqui em diante)
ALTER TABLE vistos_v2
  ADD CONSTRAINT vistos_v2_atividade_aluno_unique
  UNIQUE (atividade_id, aluno_id);

-- Confirmar que funcionou:
-- SELECT COUNT(*) FROM vistos_v2; -- total de registros
-- SELECT atividade_id, aluno_id, COUNT(*) FROM vistos_v2 GROUP BY 1,2 HAVING COUNT(*) > 1; -- deve retornar 0 linhas
