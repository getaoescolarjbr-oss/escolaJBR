-- Corrige a listagem para que o criador da avaliação sempre a veja
-- E permite áreas com 0 questões (para receber nota) desde que o total seja >= 1

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
      p_area_conhecimento IS NULL
      OR p.area_conhecimento = p_area_conhecimento
      OR (p.eh_prova_geral AND EXISTS (
        SELECT 1 FROM public.prova_geral_areas pga
        WHERE pga.prova_id = p.id AND pga.area_conhecimento = p_area_conhecimento
      ))
    )
    AND (
      v_eh_staff
      OR p.criado_por = v_usuario_id
      OR EXISTS (
        SELECT 1 FROM public.prova_area_cotas pac
        WHERE pac.prova_id = p.id
          AND pac.professor_id = v_prof_id
      )
    );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_avaliacoes_area(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_criar_avaliacao_geral(
  p_titulo TEXT,
  p_bimestre_id INTEGER,
  p_valor_total NUMERIC,
  p_modo TEXT,
  p_tipo TEXT,
  p_lancar_no_boletim BOOLEAN,
  p_data_aplicacao DATE DEFAULT NULL,
  p_prazo_entrega TIMESTAMPTZ DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_turma_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_areas JSONB DEFAULT '[]'::jsonb,
  p_embaralhar TEXT DEFAULT 'NENHUM',
  p_qtd_versoes SMALLINT DEFAULT 1,
  p_cartao_separado BOOLEAN DEFAULT false,
  p_cartao_posicao TEXT DEFAULT 'FIM',
  p_somente_nota BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova_id UUID;
  v_area RECORD;
  v_total INTEGER;
  v_ids UUID[];
  v_so_nota BOOLEAN := COALESCE(p_somente_nota, false);
BEGIN
  IF NOT public.eh_staff_avaliacao() THEN
    RAISE EXCEPTION 'Sem permissão para criar avaliação geral.';
  END IF;

  IF COALESCE(trim(p_titulo), '') = '' THEN
    RAISE EXCEPTION 'Informe o título da avaliação.';
  END IF;
  IF COALESCE(array_length(p_turma_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma turma.';
  END IF;
  IF jsonb_typeof(p_areas) <> 'array' OR jsonb_array_length(p_areas) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma área participante.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_areas) a
    WHERE a ->> 'area' NOT IN ('Ciências da Natureza', 'Ciências Humanas', 'Matemática', 'Linguagens')
       OR (NOT v_so_nota AND COALESCE((a ->> 'qtd_questoes')::INTEGER, 0) < 0)
  ) THEN
    RAISE EXCEPTION 'Cada área participante precisa ser válida e não pode ter quantidade negativa de questões.';
  END IF;

  SELECT CASE WHEN v_so_nota THEN 0 ELSE COALESCE(SUM((a ->> 'qtd_questoes')::INTEGER), 0) END
  INTO v_total FROM jsonb_array_elements(p_areas) a;

  IF NOT v_so_nota AND v_total < 1 THEN
    RAISE EXCEPTION 'A avaliação precisa ter pelo menos 1 questão no total.';
  END IF;

  INSERT INTO public.provas (
    titulo, disciplina, disciplina_id, bimestre_id, instrucoes, valor_total, modo, tipo,
    data_aplicacao, prazo_entrega, status, criado_por, eh_prova_area, area_conhecimento,
    status_colaboracao, embaralhar, qtd_versoes, cartao_separado, cartao_posicao,
    lancar_no_boletim, eh_prova_geral, qtd_questoes_total, somente_nota
  ) VALUES (
    trim(p_titulo), 'Avaliação Geral', NULL, p_bimestre_id, p_instrucoes, p_valor_total,
    CASE WHEN v_so_nota THEN 'IMPRESSA' ELSE p_modo END,
    CASE WHEN v_so_nota THEN 'AVALIACAO' ELSE p_tipo END,
    p_data_aplicacao, p_prazo_entrega, 'RASCUNHO', auth.uid(), true, 'Geral',
    'EM_ELABORACAO', COALESCE(p_embaralhar, 'NENHUM'), GREATEST(COALESCE(p_qtd_versoes, 1), 1),
    COALESCE(p_cartao_separado, false),
    CASE WHEN p_cartao_posicao IN ('INICIO', 'FIM') THEN p_cartao_posicao ELSE 'FIM' END,
    CASE WHEN v_so_nota THEN true ELSE COALESCE(p_lancar_no_boletim, true) END,
    true, v_total, v_so_nota
  )
  RETURNING id INTO v_prova_id;

  INSERT INTO public.prova_turmas (prova_id, turma_id)
  SELECT v_prova_id, unnest(p_turma_ids);

  FOR v_area IN
    SELECT a.value AS item, a.ordinality AS ordem
    FROM jsonb_array_elements(p_areas) WITH ORDINALITY AS a(value, ordinality)
  LOOP
    INSERT INTO public.prova_geral_areas (prova_id, area_conhecimento, qtd_questoes, ordem)
    VALUES (v_prova_id, v_area.item ->> 'area',
            CASE WHEN v_so_nota THEN 0 ELSE (v_area.item ->> 'qtd_questoes')::INTEGER END,
            v_area.ordem);

    IF NOT v_so_nota THEN
      SELECT COALESCE(array_agg(x::UUID), ARRAY[]::UUID[]) INTO v_ids
      FROM jsonb_array_elements_text(COALESCE(v_area.item -> 'questoes', '[]'::jsonb)) x;

      IF array_length(v_ids, 1) > (v_area.item ->> 'qtd_questoes')::INTEGER THEN
        RAISE EXCEPTION 'A área % tem mais questões sorteadas do que o previsto.', v_area.item ->> 'area';
      END IF;

      PERFORM public.prova_geral_gravar_sorteadas(v_prova_id, v_area.item ->> 'area', v_ids);
    END IF;
  END LOOP;

  IF NOT v_so_nota THEN
    PERFORM public.prova_geral_reorganizar(v_prova_id);
  END IF;
  RETURN v_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_criar_avaliacao_geral(TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB, TEXT, SMALLINT, BOOLEAN, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_editar_avaliacao_geral(
  p_prova_id UUID,
  p_titulo TEXT,
  p_bimestre_id INTEGER,
  p_valor_total NUMERIC,
  p_modo TEXT,
  p_tipo TEXT,
  p_lancar_no_boletim BOOLEAN,
  p_data_aplicacao DATE DEFAULT NULL,
  p_prazo_entrega TIMESTAMPTZ DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_turma_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_areas JSONB DEFAULT '[]'::jsonb,
  p_embaralhar TEXT DEFAULT 'NENHUM',
  p_qtd_versoes SMALLINT DEFAULT 1,
  p_cartao_separado BOOLEAN DEFAULT false,
  p_cartao_posicao TEXT DEFAULT 'FIM'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
  v_problema TEXT;
  v_so_nota BOOLEAN;
  v_total INTEGER;
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND OR NOT v_prova.eh_prova_geral THEN
    RAISE EXCEPTION 'Avaliação geral não encontrada.';
  END IF;
  v_so_nota := v_prova.somente_nota;
  IF NOT (v_prova.criado_por = auth.uid() OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Somente quem criou a avaliação geral (ou a coordenação/gestão) pode editá-la.';
  END IF;
  IF v_prova.status = 'PUBLICADA' THEN
    RAISE EXCEPTION 'Avaliação já publicada não pode ser editada. Despublique antes.';
  END IF;

  IF COALESCE(trim(p_titulo), '') = '' THEN
    RAISE EXCEPTION 'Informe o título da avaliação.';
  END IF;
  IF COALESCE(array_length(p_turma_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma turma.';
  END IF;
  IF jsonb_typeof(p_areas) <> 'array' OR jsonb_array_length(p_areas) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma área participante.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_areas) a
    WHERE a ->> 'area' NOT IN ('Ciências da Natureza', 'Ciências Humanas', 'Matemática', 'Linguagens')
       OR (NOT v_so_nota AND COALESCE((a ->> 'qtd_questoes')::INTEGER, 0) < 0)
  ) THEN
    RAISE EXCEPTION 'Cada área participante precisa ser válida e não pode ter quantidade negativa de questões.';
  END IF;

  SELECT CASE WHEN v_so_nota THEN 0 ELSE COALESCE(SUM((a ->> 'qtd_questoes')::INTEGER), 0) END
  INTO v_total FROM jsonb_array_elements(p_areas) a;

  IF NOT v_so_nota AND v_total < 1 THEN
    RAISE EXCEPTION 'A avaliação precisa ter pelo menos 1 questão no total.';
  END IF;

  SELECT string_agg(pga.area_conhecimento, ', ') INTO v_problema
  FROM public.prova_geral_areas pga
  WHERE pga.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pga.area_conhecimento)
    AND EXISTS (SELECT 1 FROM public.prova_questoes pq WHERE pq.prova_id = p_prova_id AND pq.area_conhecimento = pga.area_conhecimento);
  IF v_problema IS NOT NULL THEN
    RAISE EXCEPTION 'Não dá para retirar área que já tem questões: %. Remova as questões dela antes.', v_problema;
  END IF;

  IF NOT v_so_nota THEN
    SELECT string_agg(x.area || ' (mínimo ' || x.distribuido || ')', ', ') INTO v_problema
    FROM (
      SELECT a ->> 'area' AS area, (a ->> 'qtd_questoes')::INTEGER AS qtd,
        COALESCE((SELECT SUM(pac.qtd_questoes) FROM public.prova_area_cotas pac
                  WHERE pac.prova_id = p_prova_id AND pac.area_conhecimento = a ->> 'area'), 0)
        + (SELECT count(*) FROM public.prova_questoes pq
           WHERE pq.prova_id = p_prova_id AND pq.area_conhecimento = a ->> 'area' AND pq.cota_id IS NULL) AS distribuido
      FROM jsonb_array_elements(p_areas) a
    ) x
    WHERE x.qtd < x.distribuido;
    IF v_problema IS NOT NULL THEN
      RAISE EXCEPTION 'A quantidade de questões ficou abaixo do que já foi distribuído: %.', v_problema;
    END IF;
  END IF;

  UPDATE public.provas SET
    titulo = trim(p_titulo),
    bimestre_id = p_bimestre_id,
    valor_total = p_valor_total,
    modo = CASE WHEN v_so_nota THEN 'IMPRESSA' ELSE p_modo END,
    tipo = CASE WHEN v_so_nota THEN 'AVALIACAO' ELSE p_tipo END,
    lancar_no_boletim = CASE WHEN v_so_nota THEN true ELSE COALESCE(p_lancar_no_boletim, true) END,
    data_aplicacao = p_data_aplicacao,
    prazo_entrega = p_prazo_entrega,
    instrucoes = p_instrucoes,
    embaralhar = COALESCE(p_embaralhar, 'NENHUM'),
    qtd_versoes = GREATEST(COALESCE(p_qtd_versoes, 1), 1),
    cartao_separado = COALESCE(p_cartao_separado, false),
    cartao_posicao = CASE WHEN p_cartao_posicao IN ('INICIO', 'FIM') THEN p_cartao_posicao ELSE 'FIM' END,
    qtd_questoes_total = v_total,
    updated_at = now()
  WHERE id = p_prova_id;

  DELETE FROM public.prova_turmas WHERE prova_id = p_prova_id;
  INSERT INTO public.prova_turmas (prova_id, turma_id)
  SELECT p_prova_id, unnest(p_turma_ids);

  -- Corretor de turma que saiu da avaliação não faz mais sentido.
  DELETE FROM public.prova_corretores pc
  WHERE pc.prova_id = p_prova_id AND NOT (pc.turma_id = ANY(p_turma_ids));

  DELETE FROM public.prova_area_cotas pac
  WHERE pac.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pac.area_conhecimento);
  DELETE FROM public.prova_notas_professores pnp
  WHERE pnp.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pnp.area_conhecimento);
  DELETE FROM public.prova_geral_areas pga
  WHERE pga.prova_id = p_prova_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_areas) a WHERE a ->> 'area' = pga.area_conhecimento);

  INSERT INTO public.prova_geral_areas (prova_id, area_conhecimento, qtd_questoes, ordem)
  SELECT p_prova_id, a.value ->> 'area',
         CASE WHEN v_so_nota THEN 0 ELSE (a.value ->> 'qtd_questoes')::INTEGER END,
         a.ordinality
  FROM jsonb_array_elements(p_areas) WITH ORDINALITY AS a(value, ordinality)
  ON CONFLICT (prova_id, area_conhecimento)
  DO UPDATE SET qtd_questoes = EXCLUDED.qtd_questoes, ordem = EXCLUDED.ordem;

  IF NOT v_so_nota THEN
    PERFORM public.prova_geral_reorganizar(p_prova_id);
  END IF;
  RETURN p_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_editar_avaliacao_geral(UUID, TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB, TEXT, SMALLINT, BOOLEAN, TEXT) TO authenticated;
