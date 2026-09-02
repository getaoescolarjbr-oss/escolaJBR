-- A pedido: coordenador de área encontrou questões ENEM/INEP duplicadas no banco e precisa
-- conseguir excluí-las pela tela de Gerenciar Questões, sem depender de GESTAO pra cada caso.
-- Só DELETE — criar/editar questão continua restrito a GESTAO/PROFESSOR (política existente em
-- permitir_professor_editar_questoes.sql), pra não abrir escrita livre do banco compartilhado.

CREATE POLICY "Coordenação de área pode excluir questões"
  ON public.questions FOR DELETE
  TO authenticated
  USING (public.usuario_tem_papel('COORDENACAO_AREA'));
