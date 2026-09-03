-- ====================================================================================
-- FIX: rpc_listar_avaliacoes_area estava devolvendo TODAS as avaliações de área
-- (eh_prova_area = true) para qualquer usuário autenticado, sem checar se o professor
-- que chamou tem cota (prova_area_cotas) na avaliação. Resultado: toda avaliação de
-- área aparecia em "Minhas Avaliações" de TODOS os professores, não só dos selecionados
-- pelo coordenador ao criar a cota.
--
-- Corrige restringindo o retorno, para quem não é COORDENACAO_AREA/COORDENACAO/GESTAO,
-- às avaliações em que o professor logado tem uma linha em prova_area_cotas.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_listar_avaliacoes_area(p_area_conhecimento TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_prof_id UUID;
  v_eh_staff BOOLEAN;
  v_result JSONB;
BEGIN
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = v_usuario_id;

  v_eh_staff := public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO');

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'titulo', p.titulo,
      'area_conhecimento', p.area_conhecimento,
      'bimestre_id', p.bimestre_id,
      'valor_total', p.valor_total,
      'modo', p.modo,
      'tipo', p.tipo,
      'status', p.status,
      'status_colaboracao', p.status_colaboracao,
      'data_aplicacao', p.data_aplicacao,
      'prazo_entrega', p.prazo_entrega,
      'instrucoes', p.instrucoes,
      'created_at', p.created_at,
      'total_questoes', (SELECT count(*) FROM public.prova_questoes pq WHERE pq.prova_id = p.id),
      'turma_nomes', (
        SELECT jsonb_agg(t.nome)
        FROM public.prova_turmas pt
        JOIN public.turmas t ON t.id = pt.turma_id
        WHERE pt.prova_id = p.id
      ),
      'cotas', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pac.id,
            'professor_id', pac.professor_id,
            'professor_nome', prof.nome,
            'disciplina_id', pac.disciplina_id,
            'disciplina_nome', d.nome,
            'qtd_questoes', pac.qtd_questoes,
            'qtd_inserida', pac.qtd_inserida
          )
        )
        FROM public.prova_area_cotas pac
        JOIN public.professores prof ON prof.id = pac.professor_id
        LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
        WHERE pac.prova_id = p.id
      )
    ) ORDER BY p.created_at DESC
  ) INTO v_result
  FROM public.provas p
  WHERE p.eh_prova_area = true
    AND (p_area_conhecimento IS NULL OR p.area_conhecimento = p_area_conhecimento)
    -- Professor comum só vê avaliações em que tem cota; staff de área vê todas (filtradas
    -- só por p_area_conhecimento, como antes).
    AND (
      v_eh_staff
      OR EXISTS (
        SELECT 1 FROM public.prova_area_cotas pac
        WHERE pac.prova_id = p.id
          AND pac.professor_id = v_prof_id
      )
    );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_avaliacoes_area TO authenticated;
