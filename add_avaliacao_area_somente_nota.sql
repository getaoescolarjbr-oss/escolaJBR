-- ====================================================================================
-- AVALIAÇÃO DA ÁREA SÓ DE NOTA
--
-- Igual à avaliação geral só de nota, mas de uma área só: sem questões nem cotas. O
-- coordenador escolhe os professores da área que recebem a nota; ao publicar, o campo
-- de nota é criado no diário deles, só nas turmas em que dão aula (alocacoes_v2).
-- Quem recebe a nota fica em prova_notas_professores (a mesma tabela da geral).
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Criar / editar (p_prova_id NULL = criar)
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_salvar_avaliacao_area_so_nota(
  p_prova_id UUID,
  p_titulo TEXT,
  p_area_conhecimento TEXT,
  p_bimestre_id INTEGER,
  p_valor_total NUMERIC,
  p_data_aplicacao DATE DEFAULT NULL,
  p_turma_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_notas JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
  v_prova_id UUID := p_prova_id;
BEGIN
  IF NOT public.eh_staff_avaliacao() THEN
    RAISE EXCEPTION 'Sem permissão para salvar avaliação de área.';
  END IF;
  IF p_area_conhecimento NOT IN ('Ciências da Natureza', 'Ciências Humanas', 'Matemática', 'Linguagens') THEN
    RAISE EXCEPTION 'Área inválida.';
  END IF;
  IF COALESCE(trim(p_titulo), '') = '' THEN
    RAISE EXCEPTION 'Informe o título da avaliação.';
  END IF;
  IF COALESCE(array_length(p_turma_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos uma turma.';
  END IF;
  IF jsonb_typeof(p_notas) <> 'array' OR NOT EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_notas) AS x(professor_id UUID, disciplina_id UUID)
    WHERE x.professor_id IS NOT NULL AND x.disciplina_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Selecione pelo menos um professor para receber a nota.';
  END IF;

  IF v_prova_id IS NULL THEN
    INSERT INTO public.provas (
      titulo, disciplina, disciplina_id, bimestre_id, valor_total, modo, tipo,
      data_aplicacao, status, criado_por, eh_prova_area, area_conhecimento,
      status_colaboracao, lancar_no_boletim, eh_prova_geral, qtd_questoes_total,
      somente_nota, modo_nota
    ) VALUES (
      trim(p_titulo), p_area_conhecimento, NULL, p_bimestre_id, p_valor_total, 'IMPRESSA', 'AVALIACAO',
      p_data_aplicacao, 'RASCUNHO', auth.uid(), true, p_area_conhecimento,
      'EM_ELABORACAO', true, false, 0,
      true, 'DIRETA'
    )
    RETURNING id INTO v_prova_id;
  ELSE
    SELECT * INTO v_prova FROM public.provas WHERE id = v_prova_id;
    IF NOT FOUND OR NOT v_prova.eh_prova_area OR v_prova.eh_prova_geral OR NOT v_prova.somente_nota THEN
      RAISE EXCEPTION 'Avaliação da área só de nota não encontrada.';
    END IF;
    IF v_prova.status = 'PUBLICADA' THEN
      RAISE EXCEPTION 'Avaliação já publicada não pode ser editada. Despublique antes.';
    END IF;

    UPDATE public.provas SET
      titulo = trim(p_titulo),
      bimestre_id = p_bimestre_id,
      valor_total = p_valor_total,
      data_aplicacao = p_data_aplicacao,
      updated_at = now()
    WHERE id = v_prova_id;

    DELETE FROM public.prova_turmas WHERE prova_id = v_prova_id;
    DELETE FROM public.prova_corretores pc
    WHERE pc.prova_id = v_prova_id AND NOT (pc.turma_id = ANY(p_turma_ids));
  END IF;

  INSERT INTO public.prova_turmas (prova_id, turma_id)
  SELECT DISTINCT v_prova_id, unnest(p_turma_ids);

  DELETE FROM public.prova_notas_professores WHERE prova_id = v_prova_id;
  INSERT INTO public.prova_notas_professores (prova_id, professor_id, disciplina_id, area_conhecimento)
  SELECT DISTINCT v_prova_id, x.professor_id, x.disciplina_id, p_area_conhecimento
  FROM jsonb_to_recordset(p_notas) AS x(professor_id UUID, disciplina_id UUID)
  WHERE x.professor_id IS NOT NULL AND x.disciplina_id IS NOT NULL;

  RETURN v_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_salvar_avaliacao_area_so_nota(UUID, TEXT, TEXT, INTEGER, NUMERIC, DATE, UUID[], JSONB) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 2. Publicar: a área só de nota cria os campos a partir de prova_notas_professores
--    (como a geral), e não das cotas.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_publicar_avaliacao_area(p_prova_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prova public.provas;
  v_cota RECORD;
  v_turma RECORD;
  v_nota RECORD;
  v_nota_id UUID;
  v_pendentes TEXT;
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;

  IF v_prova.eh_prova_geral THEN
    IF NOT (v_prova.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO')) THEN
      RAISE EXCEPTION 'Somente quem criou a avaliação geral pode publicá-la.';
    END IF;

    SELECT string_agg(pga.area_conhecimento || ' (' || COALESCE(q.qtd, 0) || '/' || pga.qtd_questoes || ')', ', ' ORDER BY pga.ordem)
    INTO v_pendentes
    FROM public.prova_geral_areas pga
    LEFT JOIN (
      SELECT area_conhecimento, count(*) AS qtd
      FROM public.prova_questoes WHERE prova_id = p_prova_id
      GROUP BY area_conhecimento
    ) q ON q.area_conhecimento = pga.area_conhecimento
    WHERE pga.prova_id = p_prova_id
      AND COALESCE(q.qtd, 0) <> pga.qtd_questoes;

    IF v_pendentes IS NOT NULL THEN
      RAISE EXCEPTION 'Ainda há áreas sem a quantidade prevista de questões: %.', v_pendentes;
    END IF;
  ELSE
    IF NOT (
      v_prova.criado_por = auth.uid()
      OR public.usuario_tem_papel('COORDENACAO_AREA')
      OR public.usuario_tem_papel('COORDENACAO')
      OR public.usuario_tem_papel('GESTAO')
    ) THEN
      RAISE EXCEPTION 'Sem permissão para publicar esta avaliação de área.';
    END IF;
  END IF;

  -- Geral e área só de nota: quem recebe a nota está em prova_notas_professores, e o
  -- campo só é criado nas turmas em que o professor dá aula daquela disciplina.
  IF v_prova.eh_prova_geral OR v_prova.somente_nota THEN
    IF v_prova.lancar_no_boletim AND v_prova.modo_nota <> 'SEM_NOTA'
       AND NOT EXISTS (SELECT 1 FROM public.prova_notas_professores WHERE prova_id = p_prova_id) THEN
      RAISE EXCEPTION 'Nenhum professor foi selecionado para receber a nota.';
    END IF;

    UPDATE public.provas
    SET status = 'PUBLICADA', status_colaboracao = 'PUBLICADA'
    WHERE id = p_prova_id;

    IF v_prova.lancar_no_boletim AND v_prova.modo_nota <> 'SEM_NOTA' AND v_prova.bimestre_id IS NOT NULL THEN
      FOR v_nota IN
        SELECT DISTINCT pnp.professor_id, pnp.disciplina_id, d.nome AS disciplina_nome, pt.turma_id
        FROM public.prova_notas_professores pnp
        JOIN public.prova_turmas pt ON pt.prova_id = pnp.prova_id
        JOIN public.alocacoes_v2 al
          ON al.professor_id = pnp.professor_id
         AND al.disciplina_id = pnp.disciplina_id
         AND al.turma_id = pt.turma_id
        LEFT JOIN public.disciplinas d ON d.id = pnp.disciplina_id
        WHERE pnp.prova_id = p_prova_id
      LOOP
        INSERT INTO public.avaliacoes (
          professor_id, turma_id, disciplina_id, bimestre_id, nome, valor_maximo, data_avaliacao, publicada
        ) VALUES (
          v_nota.professor_id, v_nota.turma_id, v_nota.disciplina_id, v_prova.bimestre_id,
          v_prova.titulo || ' (' || COALESCE(v_nota.disciplina_nome, v_prova.area_conhecimento) || ')',
          v_prova.valor_total, v_prova.data_aplicacao, true
        )
        RETURNING id INTO v_nota_id;

        INSERT INTO public.prova_avaliacao_notas (prova_id, turma_id, avaliacao_id)
        VALUES (p_prova_id, v_nota.turma_id, v_nota_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    RETURN jsonb_build_object('sucesso', true, 'status', 'PUBLICADA');
  END IF;

  UPDATE public.provas
  SET status = 'PUBLICADA',
      status_colaboracao = 'PUBLICADA'
  WHERE id = p_prova_id;

  IF v_prova.tipo = 'AVALIACAO' AND v_prova.modo_nota <> 'SEM_NOTA' AND v_prova.bimestre_id IS NOT NULL THEN
    FOR v_cota IN
      SELECT pac.*, p.nome AS professor_nome, d.nome AS disciplina_nome
      FROM public.prova_area_cotas pac
      JOIN public.professores p ON p.id = pac.professor_id
      LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
      WHERE pac.prova_id = p_prova_id
    LOOP
      FOR v_turma IN
        SELECT pt.turma_id
        FROM public.prova_turmas pt
        WHERE pt.prova_id = p_prova_id
      LOOP
        INSERT INTO public.avaliacoes (
          professor_id, turma_id, disciplina_id, bimestre_id, nome, valor_maximo, data_avaliacao, publicada
        ) VALUES (
          v_cota.professor_id,
          v_turma.turma_id,
          v_cota.disciplina_id,
          v_prova.bimestre_id,
          v_prova.titulo || ' (' || COALESCE(v_cota.disciplina_nome, v_prova.area_conhecimento) || ')',
          v_prova.valor_total,
          v_prova.data_aplicacao,
          true
        )
        RETURNING id INTO v_nota_id;

        INSERT INTO public.prova_avaliacao_notas (prova_id, turma_id, avaliacao_id)
        VALUES (p_prova_id, v_turma.turma_id, v_nota_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'status', 'PUBLICADA');
END;
$function$;
