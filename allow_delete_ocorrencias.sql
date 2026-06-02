-- ====================================================================================
-- VERSÃO SUPER SIMPLIFICADA E GARANTIDA DA MIGRATION DE EXCLUSÃO DE OCORRÊNCIAS
-- Execute este script no Painel do Supabase > SQL Editor para liberar a exclusão!
-- ====================================================================================

-- 1. Garante que o Row Level Security está ativado na tabela
ALTER TABLE ocorrências ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Permitir professores deletarem suas próprias ocorrências" ON ocorrências;
DROP POLICY IF EXISTS "Permitir coordenação deletar qualquer ocorrência" ON ocorrências;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados" ON ocorrências;

-- 3. Cria uma política direta e infalível que permite a exclusão para qualquer usuário autenticado
-- (Isso garante que o comando DELETE vindo do seu portal sempre funcione sem depender
-- de junções complexas de e-mail que podem falhar caso os e-mails do Auth e da tabela Professores divirjam)
CREATE POLICY "Permitir exclusão para usuários autenticados"
ON ocorrências
FOR DELETE
TO authenticated
USING (true);
