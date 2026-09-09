-- ====================================================================================
-- PROFESSOR COM COTA NUMA AVALIAÇÃO DE ÁREA PRECISA CONSEGUIR VER A PRÓPRIA PROVA
--
-- pode_corrigir_prova() (RPC, SECURITY DEFINER) já libera qualquer professor com cota
-- pra corrigir pela câmera — mas "Minhas Avaliações" lista as provas com uma consulta
-- DIRETA na tabela (supabase.from('provas').select(...)), sujeita a RLS. A policy
-- "provas_select_dono_ou_staff" só liberava o CRIADOR (normalmente o coordenador) ou
-- GESTAO/COORDENACAO — um professor que só contribuiu questões pela própria cota nunca
-- via a linha da prova aparecer, então nem o botão "Corrigir pela câmera" nem o de
-- "Folhas com QR" tinham como aparecer pra ele: a RPC de correção estava liberada, mas
-- não havia CAMINHO na tela pra chegar até ela.
--
-- Mesma lacuna em prova_questoes/prova_turmas (usadas no join do select) e em
-- prova_respostas/prova_respostas_itens (usadas pra ver os resultados já corrigidos).
-- ====================================================================================

DROP POLICY IF EXISTS "provas_select_dono_ou_staff" ON public.provas;
CREATE POLICY "provas_select_dono_ou_staff"
  ON public.provas FOR SELECT TO authenticated
  USING (
    criado_por = auth.uid()
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR EXISTS (
      SELECT 1 FROM public.prova_area_cotas pac
      JOIN public.professores prof ON prof.id = pac.professor_id
      WHERE pac.prova_id = provas.id AND prof.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prova_questoes_all_dono_ou_staff" ON public.prova_questoes;
CREATE POLICY "prova_questoes_all_dono_ou_staff"
  ON public.prova_questoes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (
        p.criado_por = auth.uid()
        OR public.usuario_tem_papel('GESTAO')
        OR public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('COORDENACAO_AREA')
        OR EXISTS (
          SELECT 1 FROM public.prova_area_cotas pac
          JOIN public.professores prof ON prof.id = pac.professor_id
          WHERE pac.prova_id = p.id AND prof.user_id = auth.uid()
        )
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  ));

DROP POLICY IF EXISTS "prova_turmas_all_dono_ou_staff" ON public.prova_turmas;
CREATE POLICY "prova_turmas_all_dono_ou_staff"
  ON public.prova_turmas FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (
        p.criado_por = auth.uid()
        OR public.usuario_tem_papel('GESTAO')
        OR public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('COORDENACAO_AREA')
        OR EXISTS (
          SELECT 1 FROM public.prova_area_cotas pac
          JOIN public.professores prof ON prof.id = pac.professor_id
          WHERE pac.prova_id = p.id AND prof.user_id = auth.uid()
        )
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  ));

DROP POLICY IF EXISTS "prova_respostas_select_dono_staff_ou_proprio_aluno" ON public.prova_respostas;
CREATE POLICY "prova_respostas_select_dono_staff_ou_proprio_aluno"
  ON public.prova_respostas FOR SELECT TO authenticated
  USING (
    aluno_id = public.meu_aluno_id()
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR EXISTS (SELECT 1 FROM public.provas p WHERE p.id = prova_id AND p.criado_por = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.prova_area_cotas pac
      JOIN public.professores prof ON prof.id = pac.professor_id
      WHERE pac.prova_id = prova_respostas.prova_id AND prof.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prova_respostas_itens_select_dono_staff_ou_proprio_aluno" ON public.prova_respostas_itens;
CREATE POLICY "prova_respostas_itens_select_dono_staff_ou_proprio_aluno"
  ON public.prova_respostas_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prova_respostas r WHERE r.id = resposta_id AND (
      r.aluno_id = public.meu_aluno_id()
      OR public.usuario_tem_papel('GESTAO')
      OR public.usuario_tem_papel('COORDENACAO')
      OR public.usuario_tem_papel('COORDENACAO_AREA')
      OR EXISTS (SELECT 1 FROM public.provas p WHERE p.id = r.prova_id AND p.criado_por = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.prova_area_cotas pac
        JOIN public.professores prof ON prof.id = pac.professor_id
        WHERE pac.prova_id = r.prova_id AND prof.user_id = auth.uid()
      )
    )
  ));
