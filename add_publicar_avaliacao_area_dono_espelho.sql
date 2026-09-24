-- Publicação de avaliação: o campo de nota vai para o DONO do diário, não para o substituto.
--
-- Quando um professor está substituindo outro (atestado com espelhamento de turmas em
-- alocacoes_v2), o substituto trabalha sobre o diário do TITULAR (ver Dashboard). Se a nota
-- fosse criada no nome do substituto, o campo ficaria invisível nesse diário e o titular não o
-- receberia na volta. Então, ao publicar:
--   * avaliação geral / só de nota: a alocação espelho aponta o titular (professor_original_id);
--     o DISTINCT junta titular + substituto marcados na mesma disciplina/turma num campo só;
--   * avaliação da área: o dono do campo em cada turma é o titular quando a turma do substituto é
--     espelho (senão, o próprio professor da cota).
-- Quem INSERE as questões continua sendo o professor da cota (a substituta, se for ela).
--
-- Só mudam os pontos marcados com "-- espelho". Reverter: recriar a função com o texto anterior
-- (copiado no scratchpad da sessão em reverter_publicar_avaliacao_area.sql).
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
  v_dono UUID; -- espelho
BEGIN
  -- trava por área
  PERFORM public.exigir_prova_da_area(p_prova_id);

  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avaliação não encontrada.'; END IF;

  IF v_prova.eh_prova_geral THEN
    IF NOT (v_prova.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO')) THEN
      RAISE EXCEPTION 'Somente quem criou a avaliação geral pode publicá-la.';
    END IF;
    SELECT string_agg(pga.area_conhecimento || ' (' || COALESCE(q.qtd, 0) || '/' || pga.qtd_questoes || ')', ', ' ORDER BY pga.ordem)
      INTO v_pendentes
    FROM public.prova_geral_areas pga
    LEFT JOIN (
      SELECT area_conhecimento, count(*) AS qtd FROM public.prova_questoes WHERE prova_id = p_prova_id GROUP BY area_conhecimento
    ) q ON q.area_conhecimento = pga.area_conhecimento
    WHERE pga.prova_id = p_prova_id AND COALESCE(q.qtd, 0) <> pga.qtd_questoes;
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

  IF v_prova.eh_prova_geral OR v_prova.somente_nota THEN
    IF v_prova.lancar_no_boletim AND v_prova.modo_nota <> 'SEM_NOTA'
       AND NOT EXISTS (SELECT 1 FROM public.prova_notas_professores WHERE prova_id = p_prova_id) THEN
      RAISE EXCEPTION 'Nenhum professor foi selecionado para receber a nota.';
    END IF;

    UPDATE public.provas SET status = 'PUBLICADA', status_colaboracao = 'PUBLICADA' WHERE id = p_prova_id;

    IF v_prova.lancar_no_boletim AND v_prova.modo_nota <> 'SEM_NOTA' AND v_prova.bimestre_id IS NOT NULL THEN
      FOR v_nota IN
        -- espelho: se a alocação da turma é espelho (substituição), o campo é do titular
        SELECT DISTINCT
               CASE WHEN al.is_espelho AND al.professor_original_id IS NOT NULL
                    THEN al.professor_original_id ELSE pnp.professor_id END AS professor_id,
               pnp.disciplina_id, d.nome AS disciplina_nome, pt.turma_id
        FROM public.prova_notas_professores pnp
        JOIN public.prova_turmas pt ON pt.prova_id = pnp.prova_id
        JOIN public.alocacoes_v2 al ON al.professor_id = pnp.professor_id
          AND al.disciplina_id = pnp.disciplina_id AND al.turma_id = pt.turma_id
        LEFT JOIN public.disciplinas d ON d.id = pnp.disciplina_id
        WHERE pnp.prova_id = p_prova_id
      LOOP
        INSERT INTO public.avaliacoes (
          professor_id, turma_id, disciplina_id, bimestre_id, nome, valor_maximo, data_avaliacao, publicada
        ) VALUES (
          v_nota.professor_id, v_nota.turma_id, v_nota.disciplina_id, v_prova.bimestre_id,
          v_prova.titulo || ' (' || COALESCE(v_nota.disciplina_nome, v_prova.area_conhecimento) || ')',
          v_prova.valor_total, v_prova.data_aplicacao, true
        ) RETURNING id INTO v_nota_id;

        INSERT INTO public.prova_avaliacao_notas (prova_id, turma_id, avaliacao_id)
        VALUES (p_prova_id, v_nota.turma_id, v_nota_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    RETURN jsonb_build_object('sucesso', true, 'status', 'PUBLICADA');
  END IF;

  UPDATE public.provas SET status = 'PUBLICADA', status_colaboracao = 'PUBLICADA' WHERE id = p_prova_id;

  IF v_prova.tipo = 'AVALIACAO' AND v_prova.modo_nota <> 'SEM_NOTA' AND v_prova.bimestre_id IS NOT NULL THEN
    FOR v_cota IN
      SELECT pac.*, p.nome AS professor_nome, d.nome AS disciplina_nome
      FROM public.prova_area_cotas pac
      JOIN public.professores p ON p.id = pac.professor_id
      LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
      WHERE pac.prova_id = p_prova_id
    LOOP
      FOR v_turma IN
        SELECT pt.turma_id FROM public.prova_turmas pt WHERE pt.prova_id = p_prova_id
      LOOP
        -- espelho: dono do campo de nota nesta turma = titular, se a turma do professor da cota é espelho
        v_dono := COALESCE((
          SELECT al.professor_original_id FROM public.alocacoes_v2 al
          WHERE al.professor_id = v_cota.professor_id
            AND al.disciplina_id = v_cota.disciplina_id
            AND al.turma_id = v_turma.turma_id
            AND al.is_espelho AND al.professor_original_id IS NOT NULL
          LIMIT 1
        ), v_cota.professor_id);

        INSERT INTO public.avaliacoes (
          professor_id, turma_id, disciplina_id, bimestre_id, nome, valor_maximo, data_avaliacao, publicada
        ) VALUES (
          v_dono, v_turma.turma_id, v_cota.disciplina_id, v_prova.bimestre_id,
          v_prova.titulo || ' (' || COALESCE(v_cota.disciplina_nome, v_prova.area_conhecimento) || ')',
          v_prova.valor_total, v_prova.data_aplicacao, true
        ) RETURNING id INTO v_nota_id;

        INSERT INTO public.prova_avaliacao_notas (prova_id, turma_id, avaliacao_id)
        VALUES (p_prova_id, v_turma.turma_id, v_nota_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'status', 'PUBLICADA');
END;
$function$;
