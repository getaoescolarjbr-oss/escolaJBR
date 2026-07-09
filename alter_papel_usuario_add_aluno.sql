-- ====================================================================================
-- BIBLIOTECA — Pré-requisito: adiciona o papel ALUNO ao enum papel_usuario (Fundação).
-- Precisa rodar SOZINHO, em sua própria execução — Postgres não permite usar um valor
-- de enum recém-criado (ADD VALUE) na mesma transação/execução que o adiciona. Rode
-- este arquivo primeiro; só depois rode os demais create_biblioteca_*.sql.
-- ====================================================================================
ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'ALUNO';
