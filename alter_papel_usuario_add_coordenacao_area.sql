-- ====================================================================================
-- COORDENAÇÃO DE ÁREA (PCA) — Pré-requisito: adiciona COORDENACAO_AREA ao enum papel_usuario.
--
-- ATENÇÃO: Execute este comando SOZINHO no SQL Editor do Supabase antes de rodar
-- o script create_coordenacao_area_schema.sql.
-- ====================================================================================
ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'COORDENACAO_AREA';
