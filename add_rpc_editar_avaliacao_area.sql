-- Permite ao coordenador de área editar uma avaliação da área ENQUANTO ela não foi
-- publicada (status <> 'PUBLICADA') — título, bimestre, valor total, modo, tipo, datas,
-- instruções, turmas participantes e as cotas de questões por professor/disciplina.
--
-- Reconciliação das cotas: atualiza qtd_questoes das que já existem, cria as novas e
-- remove as que saíram da lista — mas RECUSA remover (ou diminuir a quantidade abaixo do já
-- inserido) uma cota que já tem questão inserida, pra não apagar trabalho de um professor
-- sem querer; a mensagem de erro diz qual cota está bloqueando.

CREATE OR REPLACE FUNCTION public.rpc_editar_avaliacao_area(
  p_prova_id UUID,
  p_titulo TEXT,
  p_bimestre_id INTEGER,
  p_valor_total NUMERIC,
  p_modo TEXT,
  p_tipo TEXT,
  p_data_aplicacao DATE DEFAULT NULL,
  p_prazo_entrega TIMESTAMPTZ DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_turma_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_cotas JSONB DEFAULT '[]'::jsonb -- array de { professor_id, disciplina_id, qtd_questoes }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_status TEXT;
  v_criado_por UUID;
  v_cota RECORD;
  v_bloqueio RECORD;
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para editar avaliação de área.';
  END IF;

  SELECT status, criado_por INTO v_status, v_criado_por
  FROM public.provas WHERE id = p_prova_id AND eh_prova_area = true;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Avaliação de área não encontrada.';
  END IF;
  IF v_status = 'PUBLICADA' THEN
    RAISE EXCEPTION 'Avaliação já publicada não pode mais ser editada.';
  END IF;
  IF NOT (v_criado_por = v_usuario_id OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('COORDENACAO')) THEN
    RAISE EXCEPTION 'Sem permissão para editar esta avaliação de área.';
  END IF;

  -- Cota removida da lista, ou com qtd_questoes menor que o já inserido, bloqueia a edição
  -- (o professor já enviou questões pra ela).
  SELECT c.professor_id, c.disciplina_id, c.qtd_inserida INTO v_bloqueio
  FROM public.prova_area_cotas c
  WHERE c.prova_id = p_prova_id
    AND c.qtd_inserida > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER)
      WHERE x.professor_id = c.professor_id
        AND x.disciplina_id IS NOT DISTINCT FROM c.disciplina_id
        AND x.qtd_questoes >= c.qtd_inserida
    )
  LIMIT 1;

  IF v_bloqueio.professor_id IS NOT NULL THEN
    RAISE EXCEPTION 'Não é possível remover ou reduzir a cota de um professor que já inseriu % questão(ões). Peça pra ele remover as questões extras antes, ou mantenha a cota com pelo menos essa quantidade.', v_bloqueio.qtd_inserida;
  END IF;

  UPDATE public.provas SET
    titulo = p_titulo,
    bimestre_id = p_bimestre_id,
    valor_total = p_valor_total,
    modo = p_modo,
    tipo = p_tipo,
    data_aplicacao = p_data_aplicacao,
    prazo_entrega = p_prazo_entrega,
    instrucoes = p_instrucoes,
    updated_at = now()
  WHERE id = p_prova_id;

  DELETE FROM public.prova_turmas WHERE prova_id = p_prova_id;
  IF array_length(p_turma_ids, 1) > 0 THEN
    INSERT INTO public.prova_turmas (prova_id, turma_id)
    SELECT p_prova_id, unnest(p_turma_ids);
  END IF;

  -- Remove cotas que saíram da lista (já garantido acima que nenhuma tinha questão inserida)
  DELETE FROM public.prova_area_cotas c
  WHERE c.prova_id = p_prova_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_cotas) AS x(professor_id UUID, disciplina_id UUID, qtd_questoes INTEGER)
      WHERE x.professor_id = c.professor_id AND x.disciplina_id IS NOT DISTINCT FROM c.disciplina_id
    );

  -- Upsert: atualiza quantidade das que continuam, cria as novas
  FOR v_cota IN SELECT * FROM jsonb_to_recordset(p_cotas) AS x(
    professor_id UUID,
    disciplina_id UUID,
    qtd_questoes INTEGER
  )
  LOOP
    INSERT INTO public.prova_area_cotas (prova_id, professor_id, disciplina_id, qtd_questoes, qtd_inserida)
    VALUES (p_prova_id, v_cota.professor_id, v_cota.disciplina_id, v_cota.qtd_questoes, 0)
    ON CONFLICT (prova_id, professor_id, disciplina_id)
    DO UPDATE SET qtd_questoes = EXCLUDED.qtd_questoes, atualizado_em = now();
  END LOOP;

  RETURN p_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_editar_avaliacao_area(UUID, TEXT, INTEGER, NUMERIC, TEXT, TEXT, DATE, TIMESTAMPTZ, TEXT, UUID[], JSONB) TO authenticated;
