-- ====================================================================================
-- CORRIGE RECURSÃO INFINITA NAS POLICIES DE provas/prova_area_cotas
--
-- add_rls_avaliacao_area_professor_cota.sql fez "provas_select_dono_ou_staff" consultar
-- prova_area_cotas — mas "prova_area_cotas_all_dono_ou_staff" (já existente) consulta
-- provas de volta. Isso forma um ciclo: ler provas -> avalia policy -> lê
-- prova_area_cotas -> avalia policy -> lê provas -> ... -> Postgres detecta e devolve
-- erro (surgia como 500 Internal Server Error em /rest/v1/provas e /rest/v1/prova_respostas).
--
-- Fix: a checagem "este professor tem cota nesta prova?" vira uma função SECURITY
-- DEFINER — mesmo truque de pode_gerir_prova() — que executa com o privilégio de quem
-- criou a função, não do usuário logado. Chamando outra tabela de dentro de uma
-- SECURITY DEFINER não reaciona a policy de quem chamou, e o ciclo se quebra.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.professor_tem_cota_area(p_prova_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM prova_area_cotas pac
    JOIN professores prof ON prof.id = pac.professor_id
    WHERE pac.prova_id = p_prova_id AND prof.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.professor_tem_cota_area(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.professor_tem_cota_area(uuid) TO authenticated;


DROP POLICY IF EXISTS "provas_select_dono_ou_staff" ON public.provas;
CREATE POLICY "provas_select_dono_ou_staff"
  ON public.provas FOR SELECT TO authenticated
  USING (
    criado_por = auth.uid()
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('COORDENACAO_AREA')
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
        OR public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('COORDENACAO_AREA')
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
        OR public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('COORDENACAO_AREA')
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
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('COORDENACAO_AREA')
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
      OR public.usuario_tem_papel('COORDENACAO')
      OR public.usuario_tem_papel('COORDENACAO_AREA')
      OR EXISTS (SELECT 1 FROM public.provas p WHERE p.id = r.prova_id AND p.criado_por = auth.uid())
      OR public.professor_tem_cota_area(r.prova_id)
    )
  ));
