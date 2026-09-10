-- ====================================================================================
-- "MINHAS AVALIAÇÕES" ESTAVA MOSTRANDO AVALIAÇÃO DE QUALQUER UM PRA QUALQUER PROFESSOR
--
-- A policy original (de antes desta sessão) já liberava COORDENACAO e COORDENACAO_AREA
-- pra ver TODA prova via provas_select_dono_ou_staff — não só as de área, qualquer
-- avaliação individual de qualquer professor. Isso nunca deveria valer pra "Minhas
-- Avaliações": esse acesso amplo de coordenação é pra a aba "Coordenação de Área"
-- (rpc_listar_avaliacoes_area, uma RPC separada, SECURITY DEFINER, que continua do
-- jeito que está — ali sim faz sentido o coordenador ver as avaliações de área que
-- coordena).
--
-- Regra pedida agora, só pra esta tabela/listagem:
-- - Avaliação individual: só quem criou (e GESTAO, que segue com visão geral).
-- - Avaliação de área: só quem criou e os professores com cota NAQUELA prova
--   específica (já era assim desde add_rls_avaliacao_area_professor_cota.sql) — sem
--   mais o blanket de COORDENACAO/COORDENACAO_AREA.
-- ====================================================================================

DROP POLICY IF EXISTS "provas_select_dono_ou_staff" ON public.provas;
CREATE POLICY "provas_select_dono_ou_staff"
  ON public.provas FOR SELECT TO authenticated
  USING (
    criado_por = auth.uid()
    OR public.usuario_tem_papel('GESTAO')
    OR public.professor_tem_cota_area(id)
  );

DROP POLICY IF EXISTS "prova_questoes_all_dono_ou_staff" ON public.prova_questoes;
CREATE POLICY "prova_questoes_all_dono_ou_staff"
  ON public.prova_questoes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (
        p.criado_por = auth.uid()
        OR public.usuario_tem_papel('GESTAO')
        OR public.professor_tem_cota_area(p.id)
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
        OR public.professor_tem_cota_area(p.id)
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
    OR EXISTS (SELECT 1 FROM public.provas p WHERE p.id = prova_id AND p.criado_por = auth.uid())
    OR public.professor_tem_cota_area(prova_id)
  );

DROP POLICY IF EXISTS "prova_respostas_itens_select_dono_staff_ou_proprio_aluno" ON public.prova_respostas_itens;
CREATE POLICY "prova_respostas_itens_select_dono_staff_ou_proprio_aluno"
  ON public.prova_respostas_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prova_respostas r WHERE r.id = resposta_id AND (
      r.aluno_id = public.meu_aluno_id()
      OR public.usuario_tem_papel('GESTAO')
      OR EXISTS (SELECT 1 FROM public.provas p WHERE p.id = r.prova_id AND p.criado_por = auth.uid())
      OR public.professor_tem_cota_area(r.prova_id)
    )
  ));
