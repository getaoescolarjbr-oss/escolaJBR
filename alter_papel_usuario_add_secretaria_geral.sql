-- ====================================================================================
-- SECRETÁRIA GERAL — adiciona SECRETARIA_GERAL ao enum papel_usuario.
--
-- ATENÇÃO: Execute este comando SOZINHO no SQL Editor do Supabase (ALTER TYPE ... ADD
-- VALUE não pode rodar dentro da mesma transação de outros comandos).
-- ====================================================================================
ALTER TYPE papel_usuario ADD VALUE IF NOT EXISTS 'SECRETARIA_GERAL';
