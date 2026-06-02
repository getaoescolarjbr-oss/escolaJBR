-- ====================================================================================
-- VERSÃO ULTRA SIMPLIFICADA DA MIGRATION PARA A TABELA "mensagens_coordenacao"
-- Execute este script no Painel do Supabase > SQL Editor para liberar todas as operações!
-- ====================================================================================

-- 1. Ativa o Row Level Security na tabela
ALTER TABLE mensagens_coordenacao ENABLE ROW LEVEL SECURITY;

-- 2. Remove todas as políticas antigas para evitar conflitos de sintaxe
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON mensagens_coordenacao;
DROP POLICY IF EXISTS "Permitir leitura de suas próprias mensagens" ON mensagens_coordenacao;
DROP POLICY IF EXISTS "Permitir deleção para remetente" ON mensagens_coordenacao;
DROP POLICY IF EXISTS "Permitir atualização para destinatário" ON mensagens_coordenacao;
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON mensagens_coordenacao;

-- 3. Cria uma política única e direta (FOR ALL) para leitura, envio, atualização e deleção
CREATE POLICY "Permitir tudo para usuários autenticados"
ON mensagens_coordenacao
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
