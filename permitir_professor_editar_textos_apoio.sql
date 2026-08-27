-- A liberação anterior (permitir_professor_editar_questoes.sql) esqueceu de estender a
-- policy de support_texts junto com a de questions — por isso salvar "texto associado"
-- como professor falhava no RLS (a tabela support_texts continuava só GESTAO).

DROP POLICY IF EXISTS "Gestão pode gerenciar textos de apoio" ON public.support_texts;
CREATE POLICY "Gestão e professores podem gerenciar textos de apoio"
  ON public.support_texts FOR ALL
  TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR'));
