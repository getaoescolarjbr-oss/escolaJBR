-- ====================================================================================
-- MIGRATION: Habilitar políticas de exclusão (DELETE) na tabela ocorrências
-- Execute este script no Painel do Supabase > SQL Editor para que a exclusão funcione!
-- ====================================================================================

-- 1. Garante que o Row Level Security está ativado na tabela
ALTER TABLE ocorrências ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas de delete antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Permitir professores deletarem suas próprias ocorrências" ON ocorrências;
DROP POLICY IF EXISTS "Permitir coordenação deletar qualquer ocorrência" ON ocorrências;

-- 3. Cria a política que permite que o próprio criador da ocorrência a delete
CREATE POLICY "Permitir professores deletarem suas próprias ocorrências"
ON ocorrências
FOR DELETE
TO authenticated
USING (
  -- Compara o ID do professor associado à ocorrência com o ID do professor logado pelo e-mail do JWT
  id_do_professor IN (
    SELECT id FROM professores WHERE email = auth.jwt()->>'email'
  )
);

-- 4. Cria a política que permite que coordenadores e diretores possam deletar qualquer ocorrência
CREATE POLICY "Permitir coordenação deletar qualquer ocorrência"
ON ocorrências
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM professores 
    WHERE email = auth.jwt()->>'email' 
    AND cargo IN ('Coordenador', 'Diretor', 'Vice-Diretor')
  )
);
