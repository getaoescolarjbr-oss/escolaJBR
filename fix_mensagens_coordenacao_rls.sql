-- ====================================================================================
-- MIGRATION: Habilitar e configurar RLS para a tabela "mensagens_coordenacao"
-- Execute este script no Painel do Supabase > SQL Editor para liberar o envio de mensagens!
-- ====================================================================================

-- 1. Ativa o Row Level Security na tabela
ALTER TABLE mensagens_coordenacao ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas de mensagens antigas se existirem
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON mensagens_coordenacao;
DROP POLICY IF EXISTS "Permitir leitura de suas próprias mensagens" ON mensagens_coordenacao;
DROP POLICY IF EXISTS "Permitir deleção para remetente" ON mensagens_coordenacao;
DROP POLICY IF EXISTS "Permitir atualização para destinatário" ON mensagens_coordenacao;

-- 3. Inserção: Permite que qualquer usuário autenticado envie comunicados (INSERT)
CREATE POLICY "Permitir inserção para usuários autenticados"
ON mensagens_coordenacao
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Leitura: Permite que usuários leiam as mensagens em que são REMETENTES ou DESTINATÁRIOS (SELECT)
CREATE POLICY "Permitir leitura de suas próprias mensagens"
ON mensagens_coordenacao
FOR SELECT
TO authenticated
USING (
  remetente_id IN (SELECT id FROM professores WHERE email = auth.jwt()->>'email')
  OR
  destinatario_id IN (SELECT id FROM professores WHERE email = auth.jwt()->>'email')
);

-- 5. Atualização: Permite que o destinatário marque as mensagens recebidas como lidas (UPDATE)
CREATE POLICY "Permitir atualização para destinatário"
ON mensagens_coordenacao
FOR UPDATE
TO authenticated
USING (
  destinatario_id IN (SELECT id FROM professores WHERE email = auth.jwt()->>'email')
)
WITH CHECK (
  destinatario_id IN (SELECT id FROM professores WHERE email = auth.jwt()->>'email')
);

-- 6. Deleção: Permite que usuários autenticados possam deletar mensagens (DELETE)
CREATE POLICY "Permitir deleção para remetente"
ON mensagens_coordenacao
FOR DELETE
TO authenticated
USING (true);
