-- ====================================================================================
-- VALOR DAS QUESTÕES DE ÁREA FICAVA DESATUALIZADO ENTRE ENVIOS DE PROFESSORES
-- DIFERENTES EM DIAS DIFERENTES
--
-- InserirQuestoesAreaModal divide o valor_total pelo total de questões PLANEJADO em
-- TODAS as cotas — mas isso é calculado no momento em que CADA professor grava a
-- própria parte. Se o professor A grava primeiro, quando só a cota dele existia (ex.:
-- 3 questões planejadas), cada questão dele sai valendo valor_total/3. Se depois o
-- coordenador ainda não tinha cadastrado as cotas dos professores B e C, e eles gravam
-- em outro dia já com o total real (9 questões), a questão de cada um deles sai valendo
-- valor_total/9 — só que a rodada do professor A nunca é atualizada. Resultado: a soma
-- dos valores das questões passa a ser MAIOR que valor_total (ex.: 6,63 numa prova de
-- 4,00), e o aluno pode acabar com nota inflada quando o sistema soma os pontos das
-- questões que ele acertou.
--
-- Fix em duas partes:
-- 1) rpc_inserir_questoes_cota_area agora rebalanceia TODAS as questões da prova (de
--    QUALQUER professor) a cada gravação, dividindo valor_total pelo total ATUAL de
--    questões já inseridas — nunca mais fica desatualizado, porque cada gravação
--    corrige a rodada inteira, não só a fatia de quem está gravando.
-- 2) Reparo pontual: recalcula o valor das questões já inseridas em toda avaliação de
--    área com soma incorreta, e ajusta a pontuação de quem já foi corrigido (objetivas
--    — dissertativas já corrigidas manualmente são só limitadas ao novo valor máximo,
--    pra não perder o julgamento do professor por uma correção de escala).
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_inserir_questoes_cota_area(
  p_prova_id UUID,
  p_disciplina_id UUID,
  p_questoes JSONB
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
  v_valor_total NUMERIC;
  v_total_atual INTEGER;
  v_valor_igual NUMERIC;
  v_ultima_question_id UUID;
BEGIN
  SELECT id INTO v_prof_id FROM public.professores WHERE user_id = v_usuario_id;
  IF v_prof_id IS NULL AND NOT (public.usuario_tem_papel('COORDENACAO_AREA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Professor não encontrado.';
  END IF;

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
  SELECT valor_total INTO v_valor_total FROM public.provas WHERE id = p_prova_id;

  DELETE FROM public.prova_questoes pq
  WHERE pq.prova_id = p_prova_id
    AND pq.question_id IN (
      SELECT q.id FROM public.questions q WHERE q.discipline = v_disciplina_nome
    );

  SELECT COALESCE(MAX(ordem), 0) INTO v_ordem_base FROM public.prova_questoes WHERE prova_id = p_prova_id;

  FOR v_q IN SELECT * FROM jsonb_to_recordset(p_questoes) AS x(question_id UUID, valor NUMERIC)
  LOOP
    v_ordem_base := v_ordem_base + 1;
    INSERT INTO public.prova_questoes (prova_id, question_id, ordem, valor)
    VALUES (p_prova_id, v_q.question_id, v_ordem_base, COALESCE(v_q.valor, 1.0));
  END LOOP;

  UPDATE public.prova_area_cotas
  SET qtd_inserida = v_total_questoes,
      atualizado_em = now()
  WHERE id = v_cota.id;

  -- Rebalanceia TODAS as questões da prova (de todo professor) pelo total ATUAL —
  -- cada gravação corrige a rodada inteira, então nunca fica com valor de uma
  -- contagem antiga. Última questão (por ordem) recebe o resto da divisão, pra soma
  -- bater exatamente com valor_total em vez de sobrar/faltar centavos de
  -- arredondamento.
  SELECT count(*) INTO v_total_atual FROM public.prova_questoes WHERE prova_id = p_prova_id;
  IF v_total_atual > 0 AND v_valor_total IS NOT NULL THEN
    v_valor_igual := round(v_valor_total / v_total_atual, 2);

    UPDATE public.prova_questoes
    SET valor = v_valor_igual
    WHERE prova_id = p_prova_id;

    SELECT question_id INTO v_ultima_question_id
    FROM public.prova_questoes WHERE prova_id = p_prova_id
    ORDER BY ordem DESC LIMIT 1;

    UPDATE public.prova_questoes
    SET valor = v_valor_total - (v_valor_igual * (v_total_atual - 1))
    WHERE prova_id = p_prova_id AND question_id = v_ultima_question_id;
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'qtd_inserida', v_total_questoes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_inserir_questoes_cota_area TO authenticated;


-- ------------------------------------------------------------------------------------
-- Reparo pontual: toda avaliação de área cuja soma dos valores das questões não bate
-- com valor_total ganha o mesmo rebalanceamento acima, e quem já tinha cartão
-- corrigido tem a pontuação das objetivas recalculada com o valor novo.
-- ------------------------------------------------------------------------------------
DO $$
DECLARE
  v_prova RECORD;
  v_resposta RECORD;
  v_total_atual INTEGER;
  v_valor_igual NUMERIC;
  v_ultima_question_id UUID;
  v_soma_atual NUMERIC;
BEGIN
  FOR v_prova IN
    SELECT p.id, p.valor_total
    FROM public.provas p
    WHERE p.eh_prova_area = true
  LOOP
    SELECT count(*), COALESCE(sum(valor), 0) INTO v_total_atual, v_soma_atual
    FROM public.prova_questoes WHERE prova_id = v_prova.id;

    IF v_total_atual = 0 OR abs(v_soma_atual - v_prova.valor_total) <= 0.01 THEN
      CONTINUE; -- nada pra corrigir nesta prova
    END IF;

    v_valor_igual := round(v_prova.valor_total / v_total_atual, 2);

    UPDATE public.prova_questoes
    SET valor = v_valor_igual
    WHERE prova_id = v_prova.id;

    SELECT question_id INTO v_ultima_question_id
    FROM public.prova_questoes WHERE prova_id = v_prova.id
    ORDER BY ordem DESC LIMIT 1;

    UPDATE public.prova_questoes
    SET valor = v_prova.valor_total - (v_valor_igual * (v_total_atual - 1))
    WHERE prova_id = v_prova.id AND question_id = v_ultima_question_id;

    -- Objetivas já corrigidas: valor_obtido acompanha o novo valor da questão quando
    -- estava certa (e continua 0 se estava errada ou anulada manualmente).
    UPDATE public.prova_respostas_itens ri
    SET valor_obtido = CASE WHEN ri.correta AND NOT ri.anulada_manual THEN pq.valor ELSE 0 END
    FROM public.prova_questoes pq
    JOIN public.prova_respostas r ON r.prova_id = pq.prova_id
    WHERE pq.prova_id = v_prova.id
      AND pq.question_id = ri.question_id
      AND ri.resposta_id = r.id
      AND ri.corrigido = true;

    -- Dissertativa/redação já corrigida manualmente: só garante que não passa do novo
    -- valor máximo da questão — preserva o julgamento do professor sem inventar uma
    -- nota nova por proporção.
    UPDATE public.prova_respostas_itens ri
    SET valor_obtido = LEAST(ri.valor_obtido, pq.valor)
    FROM public.prova_questoes pq
    JOIN public.questions q ON q.id = pq.question_id
    JOIN public.prova_respostas r ON r.prova_id = pq.prova_id
    WHERE pq.prova_id = v_prova.id
      AND pq.question_id = ri.question_id
      AND ri.resposta_id = r.id
      AND ri.corrigido = true
      AND q.tipo IN ('DISSERTATIVA', 'REDACAO');

    -- Recalcula a nota de cada resposta já existente desta prova com os valores certos.
    FOR v_resposta IN SELECT id FROM public.prova_respostas WHERE prova_id = v_prova.id
    LOOP
      PERFORM public.recalcular_nota_prova_resposta(v_resposta.id);
    END LOOP;

    RAISE NOTICE 'Prova % reparada: % questões, valor por questão %.', v_prova.id, v_total_atual, v_valor_igual;
  END LOOP;
END $$;
