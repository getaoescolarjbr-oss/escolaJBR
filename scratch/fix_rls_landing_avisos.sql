-- ============================================================
-- MIGRATION: Políticas RLS para a tabela landing_avisos
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- Projeto: hqonnxnwozfwkpqgabpf (portal-professor-jbr)
-- ============================================================

-- 1. Permitir que usuários autenticados (professores/admin) façam INSERT
CREATE POLICY "Autenticados podem inserir avisos"
  ON landing_avisos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Permitir que usuários autenticados façam UPDATE em avisos
CREATE POLICY "Autenticados podem atualizar avisos"
  ON landing_avisos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Permitir que usuários autenticados façam DELETE em avisos
CREATE POLICY "Autenticados podem deletar avisos"
  ON landing_avisos
  FOR DELETE
  TO authenticated
  USING (true);

-- 4. Permitir leitura pública (anon) para todos (já deve existir, mas garante)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'landing_avisos'
      AND policyname LIKE '%leitura%'
      AND cmd = 'SELECT'
  ) THEN
    EXECUTE 'CREATE POLICY "Leitura pública de avisos"
      ON landing_avisos
      FOR SELECT
      TO anon, authenticated
      USING (true)';
  END IF;
END $$;
