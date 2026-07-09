-- ====================================================================================
-- FUNDAÇÃO — Etapa 5: RLS adicional para a tela "Minha Conta"
-- Qualquer usuário autenticado precisa conseguir ler a PRÓPRIA linha em `pessoas`
-- (hoje só GESTAO/SECRETARIA podem ler pessoas). Sem ciclo: usuarios_select não
-- referencia pessoas, então esta subquery correlacionada não recursiona.
-- ====================================================================================
DROP POLICY IF EXISTS "pessoas_select_propria" ON pessoas;
CREATE POLICY "pessoas_select_propria" ON pessoas
  FOR SELECT
  USING (id IN (SELECT pessoa_id FROM usuarios WHERE id = auth.uid()));
