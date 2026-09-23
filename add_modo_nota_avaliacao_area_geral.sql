-- "Como calcular a nota" (sem nota / direta / ponderada) nas avaliações de área e geral,
-- igual ao gerador de provas comum (provas.modo_nota e provas.ponderada_escopo já
-- existiam — ver create_correcao_omr.sql). A tela grava pelo rpc_definir_modo_nota logo
-- depois de criar/editar a avaliação.
--
-- A publicação da avaliação de ÁREA passa a respeitar SEM_NOTA (a geral já respeitava):
-- "sem nota" gera relatório, mas não cria campo no diário.
-- (Já aplicado no banco.)

CREATE OR REPLACE FUNCTION public.rpc_definir_modo_nota(p_prova_id UUID, p_modo_nota TEXT, p_ponderada_escopo TEXT DEFAULT 'PROVA')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova public.provas;
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND OR NOT v_prova.eh_prova_area THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;
  IF NOT (v_prova.criado_por = auth.uid() OR public.eh_staff_avaliacao()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o cálculo da nota.';
  END IF;
  IF p_modo_nota NOT IN ('SEM_NOTA', 'DIRETA', 'PONDERADA') THEN
    RAISE EXCEPTION 'Modo de nota inválido.';
  END IF;
  -- Com o campo já criado no diário, virar "sem nota" deixaria nota órfã: despublique antes.
  IF v_prova.status = 'PUBLICADA' AND p_modo_nota = 'SEM_NOTA' AND v_prova.modo_nota <> 'SEM_NOTA' THEN
    RAISE EXCEPTION 'A avaliação já está publicada com nota. Despublique antes de mudar para "sem nota".';
  END IF;

  UPDATE public.provas
  SET modo_nota = p_modo_nota,
      ponderada_escopo = CASE WHEN p_ponderada_escopo IN ('PROVA', 'TURMA') THEN p_ponderada_escopo ELSE 'PROVA' END
  WHERE id = p_prova_id;

  -- Mantém nota_ponderada coerente se já houver respostas corrigidas.
  -- Falha de permissão do recálculo não pode desfazer a troca: rpc_lancar_notas_boletim
  -- recalcula de novo antes de lançar.
  IF EXISTS (SELECT 1 FROM public.prova_respostas WHERE prova_id = p_prova_id) THEN
    BEGIN
      PERFORM public.rpc_recalcular_ponderada(p_prova_id);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_definir_modo_nota(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_publicar_avaliacao_area(p_prova_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- ---------------- Avaliação geral (com questões ou só de nota) ----------------
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

    IF v_prova.lancar_no_boletim AND v_prova.modo_nota <> 'SEM_NOTA'
       AND NOT EXISTS (SELECT 1 FROM public.prova_notas_professores WHERE prova_id = p_prova_id) THEN
      RAISE EXCEPTION 'Nenhum professor foi selecionado para receber a nota. Cada PCA escolhe isso ao configurar a sua área.';
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
          v_prova.titulo || ' (' || COALESCE(v_nota.disciplina_nome, 'Geral') || ')',
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

  -- ---------------- Avaliação de área ----------------
  IF NOT (
    v_prova.criado_por = auth.uid()
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para publicar esta avaliação de área.';
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
$$;

GRANT EXECUTE ON FUNCTION public.rpc_publicar_avaliacao_area(UUID) TO authenticated;
