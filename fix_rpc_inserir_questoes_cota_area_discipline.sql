-- ====================================================================================
-- FIX: rpc_inserir_questoes_cota_area falhava com 400 "column q.discipline_id does not
-- exist" ao professor clicar em "Gravar Questões na Avaliação" — a tabela public.questions
-- não tem coluna discipline_id, só discipline (texto). O modal ficava travado porque o
-- erro do Postgres não tinha .message amigável tratado no front (e a query nunca chegava
-- a rodar).
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_inserir_questoes_cota_area(
  p_prova_id UUID,
  p_disciplina_id UUID,
  p_questoes JSONB -- array de { question_id: uuid, valor: numeric }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_prof_id UUID;
  v_cota RECORD;
  v_q RECORD;
  v_total_questoes INTEGER;
  v_ordem_base INTEGER := 0;
  v_disciplina_nome TEXT;
BEGIN
  -- Identificar professor logado
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = v_usuario_id;
  IF v_prof_id IS NULL AND NOT (public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Professor não encontrado.';
  END IF;

  -- Verificar cota
  SELECT * INTO v_cota FROM public.prova_area_cotas
  WHERE prova_id = p_prova_id
    AND (professor_id = v_prof_id OR public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('GESTAO'))
    AND (disciplina_id = p_disciplina_id OR p_disciplina_id IS NULL)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhuma cota de questões encontrada para este professor nesta avaliação.';
  END IF;

  v_total_questoes := jsonb_array_length(p_questoes);

  SELECT nome INTO v_disciplina_nome FROM public.disciplinas WHERE id = p_disciplina_id;

  -- Remover questões antigas deste professor/disciplina vinculadas à prova
  -- (recalcula ordenação). public.questions só tem a coluna discipline (texto).
  DELETE FROM public.prova_questoes pq
  WHERE pq.prova_id = p_prova_id
    AND pq.question_id IN (
      SELECT q.id FROM public.questions q WHERE q.discipline = v_disciplina_nome
    );

  -- Obter próxima ordem
  SELECT COALESCE(MAX(ordem), 0) INTO v_ordem_base FROM public.prova_questoes WHERE prova_id = p_prova_id;

  -- Inserir novas questões
  FOR v_q IN SELECT * FROM jsonb_to_recordset(p_questoes) AS x(question_id UUID, valor NUMERIC)
  LOOP
    v_ordem_base := v_ordem_base + 1;
    INSERT INTO public.prova_questoes (prova_id, question_id, ordem, valor)
    VALUES (p_prova_id, v_q.question_id, v_ordem_base, COALESCE(v_q.valor, 1.0));
  END LOOP;

  -- Atualizar quantidade inserida na cota
  UPDATE public.prova_area_cotas
  SET qtd_inserida = v_total_questoes,
      atualizado_em = now()
  WHERE id = v_cota.id;

  RETURN jsonb_build_object('sucesso', true, 'qtd_inserida', v_total_questoes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_inserir_questoes_cota_area TO authenticated;
