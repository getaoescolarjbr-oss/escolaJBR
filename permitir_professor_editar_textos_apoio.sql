-- Complementa permitir_professor_editar_questoes.sql: aquele arquivo liberou a escrita
-- de public.questions para PROFESSOR, mas esqueceu de public.support_texts (o "texto
-- associado" opcional da questão). Como QuestionEditorDialog salva o texto associado
-- antes da própria questão, ficar só com GESTAO ali travava o salvamento inteiro sempre
-- que o professor preenchia esse campo.

DROP POLICY IF EXISTS "Gestão pode gerenciar textos de apoio" ON public.support_texts;
DROP POLICY IF EXISTS "Gestão e professores podem gerenciar textos de apoio" ON public.support_texts;
CREATE POLICY "Gestão e professores podem gerenciar textos de apoio"
  ON public.support_texts FOR ALL
  TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR'));
