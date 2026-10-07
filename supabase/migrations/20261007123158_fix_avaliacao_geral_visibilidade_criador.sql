-- Corrige a listagem para que o criador da avaliação sempre a veja, 
-- mesmo que a tela tente filtrar apenas as provas da área de atuação dele.

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
  v_eh_staff := public.eh_staff_avaliacao();

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
      'embaralhar', p.embaralhar,
      'qtd_versoes', p.qtd_versoes,
      'cartao_separado', p.cartao_separado,
      'cartao_posicao', p.cartao_posicao,
      'total_questoes', (SELECT count(*) FROM public.prova_questoes pq WHERE pq.prova_id = p.id),
      'edicao_bloqueada', p.edicao_bloqueada,
      'prazo_edicao_area', p.prazo_edicao_area,
      'edicao_permitida', NOT (p.edicao_bloqueada OR (p.prazo_edicao_area IS NOT NULL AND now() > p.prazo_edicao_area)),
      'eh_prova_geral', p.eh_prova_geral,
      'somente_nota', p.somente_nota,
      'qtd_questoes_total', p.qtd_questoes_total,
      'lancar_no_boletim', p.lancar_no_boletim,
      'token_publico', p.token_publico,
      'criado_por_mim', (p.criado_por = v_usuario_id),
      'turma_ids', (SELECT jsonb_agg(pt.turma_id) FROM public.prova_turmas pt WHERE pt.prova_id = p.id),
      'turma_nomes', (
        SELECT jsonb_agg(t.nome)
        FROM public.prova_turmas pt
        JOIN public.turmas t ON t.id = pt.turma_id
        WHERE pt.prova_id = p.id
      ),
      'corretores', (
        SELECT jsonb_agg(jsonb_build_object(
          'turma_id', pc.turma_id, 'turma_nome', t.nome,
          'professor_id', pc.professor_id, 'professor_nome', prof.nome
        ) ORDER BY t.nome)
        FROM public.prova_corretores pc
        JOIN public.professores prof ON prof.id = pc.professor_id
        LEFT JOIN public.turmas t ON t.id = pc.turma_id
        WHERE pc.prova_id = p.id
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
            'qtd_inserida', pac.qtd_inserida,
            'area_conhecimento', pac.area_conhecimento,
            'eh_minha_cota', (pac.professor_id = v_prof_id)
          ) ORDER BY pac.ordem_bloco
        )
        FROM public.prova_area_cotas pac
        JOIN public.professores prof ON prof.id = pac.professor_id
        LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
        WHERE pac.prova_id = p.id
      ),
      'areas', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'area_conhecimento', pga.area_conhecimento,
            'qtd_questoes', pga.qtd_questoes,
            'ordem', pga.ordem,
            'configurada', pga.configurada,
            'qtd_inserida', (
              SELECT count(*) FROM public.prova_questoes pq
              WHERE pq.prova_id = p.id AND pq.area_conhecimento = pga.area_conhecimento
            ),
            'questoes_sorteadas', (
              SELECT COALESCE(jsonb_agg(pq.question_id ORDER BY pq.ordem), '[]'::jsonb)
              FROM public.prova_questoes pq
              WHERE pq.prova_id = p.id AND pq.area_conhecimento = pga.area_conhecimento AND pq.cota_id IS NULL
            )
          ) ORDER BY pga.ordem
        )
        FROM public.prova_geral_areas pga
        WHERE pga.prova_id = p.id
      ),
      'notas_professores', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'professor_id', pnp.professor_id,
            'professor_nome', prof.nome,
            'disciplina_id', pnp.disciplina_id,
            'disciplina_nome', d.nome,
            'area_conhecimento', pnp.area_conhecimento
          ) ORDER BY prof.nome
        )
        FROM public.prova_notas_professores pnp
        JOIN public.professores prof ON prof.id = pnp.professor_id
        LEFT JOIN public.disciplinas d ON d.id = pnp.disciplina_id
        WHERE pnp.prova_id = p.id
      )
    ) ORDER BY p.created_at DESC
  ) INTO v_result
  FROM public.provas p
  WHERE p.eh_prova_area = true
    AND (
      p.criado_por = v_usuario_id  -- O CRIADOR VÊ TUDO (ignora filtro de área e cotas)
      OR (
        (
          p_area_conhecimento IS NULL
          OR p.area_conhecimento = p_area_conhecimento
          OR (p.eh_prova_geral AND EXISTS (
            SELECT 1 FROM public.prova_geral_areas pga
            WHERE pga.prova_id = p.id AND pga.area_conhecimento = p_area_conhecimento
          ))
        )
        AND (
          v_eh_staff
          OR EXISTS (
            SELECT 1 FROM public.prova_area_cotas pac
            WHERE pac.prova_id = p.id
              AND pac.professor_id = v_prof_id
          )
        )
      )
    );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_avaliacoes_area(TEXT) TO authenticated;
