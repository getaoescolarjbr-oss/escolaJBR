-- Amplia a escrita do banco de questões (criar/editar) de GESTAO para também incluir
-- PROFESSOR, a pedido — inicialmente a escrita era só de GESTAO pra evitar descontrole
-- com muitos professores editando o banco compartilhado, mas o uso real pediu abrir.
-- Exclusão de disciplina inteira e categorias/taxonomia continuam só GESTAO.

DROP POLICY IF EXISTS "Gestão pode gerenciar questões" ON public.questions;
CREATE POLICY "Gestão e professores podem gerenciar questões"
  ON public.questions FOR ALL
  TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR'));

DROP POLICY IF EXISTS "imagens_questoes_escrita_gestao" ON storage.objects;
CREATE POLICY "imagens_questoes_escrita_gestao_professor" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imagens-questoes' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR')));

DROP POLICY IF EXISTS "imagens_questoes_update_gestao" ON storage.objects;
CREATE POLICY "imagens_questoes_update_gestao_professor" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'imagens-questoes' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('PROFESSOR')));

-- Exclusão de imagem continua restrita a GESTAO (evita professor apagar imagem usada em
-- questão de outro colega sem querer).
