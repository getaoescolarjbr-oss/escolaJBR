-- rpc_publicar_avaliacao_area (create_coordenacao_area_schema.sql) comparava
-- q.discipline_id = v_cota.disciplina_id, mas a tabela questions nunca teve coluna
-- discipline_id (só `discipline text`) -- toda publicação de avaliação de área com
-- tipo=AVALIACAO e bimestre definido quebrava com "column q.discipline_id does not exist".
-- Mantém só a comparação válida por nome (q.discipline = disciplina_nome da cota).

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
  v_nota_id UUID;
  v_prof_valor NUMERIC;
BEGIN
  SELECT * INTO v_prova FROM public.provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.';
  END IF;

  IF NOT (
    v_prova.criado_por = auth.uid()
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para publicar esta avaliação de área.';
  END IF;

  -- Atualizar status da prova
  UPDATE public.provas
  SET status = 'PUBLICADA',
      status_colaboracao = 'PUBLICADA'
  WHERE id = p_prova_id;

  -- Para cada professor/disciplina da cota e para cada turma vinculada à prova:
  -- Se o tipo for AVALIACAO (gera nota), cria o registro em avaliacoes no boletim de cada professor
  IF v_prova.tipo = 'AVALIACAO' AND v_prova.bimestre_id IS NOT NULL THEN
    FOR v_cota IN
      SELECT pac.*, p.nome AS professor_nome, d.nome AS disciplina_nome
      FROM public.prova_area_cotas pac
      JOIN public.professores p ON p.id = pac.professor_id
      LEFT JOIN public.disciplinas d ON d.id = pac.disciplina_id
      WHERE pac.prova_id = p_prova_id
    LOOP
      -- Calcular o valor total somado das questões inseridas por este professor/disciplina
      SELECT COALESCE(SUM(pq.valor), v_prova.valor_total) INTO v_prof_valor
      FROM public.prova_questoes pq
      JOIN public.questions q ON q.id = pq.question_id
      WHERE pq.prova_id = p_prova_id
        AND q.discipline = v_cota.disciplina_nome;

      IF v_prof_valor IS NULL OR v_prof_valor = 0 THEN
        v_prof_valor := v_prova.valor_total;
      END IF;

      FOR v_turma IN
        SELECT pt.turma_id
        FROM public.prova_turmas pt
        WHERE pt.prova_id = p_prova_id
      LOOP
        -- Cria a avaliação de nota no diário deste professor para esta turma
        INSERT INTO public.avaliacoes (
          professor_id,
          turma_id,
          disciplina_id,
          bimestre_id,
          nome,
          valor_maximo,
          data_avaliacao,
          publicada
        ) VALUES (
          v_cota.professor_id,
          v_turma.turma_id,
          v_cota.disciplina_id,
          v_prova.bimestre_id,
          v_prova.titulo || ' (' || COALESCE(v_cota.disciplina_nome, v_prova.area_conhecimento) || ')',
          v_prof_valor,
          v_prova.data_aplicacao,
          true
        )
        RETURNING id INTO v_nota_id;

        -- Registrar vínculo de rastreamento
        INSERT INTO public.prova_avaliacao_notas (
          prova_id,
          turma_id,
          avaliacao_id
        ) VALUES (
          p_prova_id,
          v_turma.turma_id,
          v_nota_id
        ) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'status', 'PUBLICADA');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_publicar_avaliacao_area TO authenticated;
