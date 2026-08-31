-- ====================================================================================
-- MÓDULO AGENDAMENTO — Pré-requisito: adiciona o papel PCPI ao enum papel_usuario (Fundação).
-- PCPI: Professor Coordenador de Práticas Inovadoras (gestor dos agendamentos de recursos).
--
-- ATENÇÃO: Precisa rodar SOZINHO em sua própria execução no SQL Editor do Supabase —
-- o Postgres não permite usar um valor de enum recém-criado (ADD VALUE) na mesma transação.
-- Rode este arquivo primeiro; em seguida rode add_pcpi_agendamento_schema.sql.
-- ====================================================================================
ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'PCPI';
