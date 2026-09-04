-- A pedido: coordenador de área precisa poder corrigir/editar assunto e tópico das questões
-- (inclusive juntar duplicatas escritas diferente, tipo "Acento diacrítico" vs "Acentuação
-- Diacrítica") sem depender de GESTAO pra cada ajuste.
--
-- Dá duas permissões novas, focadas nisso:
-- 1) UPDATE em questions pra COORDENACAO_AREA (só editar — criar continua só GESTAO/PROFESSOR,
--    mantendo a política já existente).
-- 2) Gerenciar (criar/renomear/excluir) termos de taxonomia, mas só dos campos 'assunto' e
--    'topico' — os outros campos (disciplina, banca, etc.) continuam só GESTAO.

DROP POLICY IF EXISTS "Coordenação de área pode editar questões" ON public.questions;
CREATE POLICY "Coordenação de área pode editar questões"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (public.usuario_tem_papel('COORDENACAO_AREA'))
  WITH CHECK (public.usuario_tem_papel('COORDENACAO_AREA'));

DROP POLICY IF EXISTS "Coordenação de área pode gerenciar assunto e tópico" ON public.question_taxonomy_terms;
CREATE POLICY "Coordenação de área pode gerenciar assunto e tópico"
  ON public.question_taxonomy_terms FOR ALL
  TO authenticated
  USING (public.usuario_tem_papel('COORDENACAO_AREA') AND field IN ('assunto', 'topico'))
  WITH CHECK (public.usuario_tem_papel('COORDENACAO_AREA') AND field IN ('assunto', 'topico'));
