-- ====================================================================================
-- MIGRATION: Liberar atualização (UPDATE) de ocorrências para usuários autenticados
-- Execute este script no Painel do Supabase > SQL Editor para corrigir o bug!
-- ====================================================================================

-- 1. Garante que o Row Level Security está ativado na tabela
ALTER TABLE ocorrências ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas de update que possam estar bloqueando os coordenadores/professores
DROP POLICY IF EXISTS "Permitir update para coordenação" ON ocorrências;
DROP POLICY IF EXISTS "Permitir update de visto coordenador para autenticados" ON ocorrências;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON ocorrências;
DROP POLICY IF EXISTS "Permitir update para usuários autenticados" ON ocorrências;
DROP POLICY IF EXISTS "Permitir update para professores" ON ocorrências;

-- 3. Cria uma política direta e permissiva para UPDATE para qualquer usuário autenticado
-- Isso garante que coordenadores e inspetores possam confirmar a leitura e registrar devolutivas
CREATE POLICY "Permitir update para usuários autenticados"
ON ocorrências
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
