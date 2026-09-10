-- ====================================================================================
-- DISSERTATIVA/REDAÇÃO SEMPRE NAS PRIMEIRAS POSIÇÕES QUANDO A PROVA EMBARALHA
--
-- Pedido: numa prova com questões mistas (objetivas + dissertativa/redação), o sorteio
-- de versões não pode misturar a dissertativa no meio da prova — ela tem que ficar
-- sempre nas primeiras posições, em toda versão a partir de agora.
--
-- Só afeta rpc_gerar_versoes_prova (usada tanto por avaliação normal quanto de área) —
-- versões JÁ sorteadas não mudam (esta função só roda de novo quando alguém clica
-- "Sortear de novo"/salva a prova, nunca sozinha).
--
-- A dissertativa mantém a ORDEM ORIGINAL entre si (não embaralha uma dissertativa
-- contra a outra) — só as objetivas são sorteadas, e só entre as posições que sobram
-- depois das dissertativas.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_gerar_versoes_prova(p_prova_id uuid)
RETURNS TABLE (rotulo text, alunos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_ordem_original uuid[];
  v_i integer;
  v_rotulo text;
  v_versao_id uuid;
  v_ordem uuid[];
  v_mapa jsonb;
  v_versao_ids uuid[] := '{}';
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerar versões desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;

  IF EXISTS (SELECT 1 FROM prova_respostas WHERE prova_id = p_prova_id AND finalizado_em IS NOT NULL)
     OR EXISTS (SELECT 1 FROM prova_leituras WHERE prova_id = p_prova_id)
  THEN
    RAISE EXCEPTION 'Esta prova já tem respostas corrigidas — refazer o sorteio invalidaria as folhas já aplicadas.';
  END IF;

  -- Garante questões únicas da prova, ordenadas pela ordem cadastrada
  SELECT array_agg(question_id ORDER BY min_ordem, question_id)
    INTO v_ordem_original
  FROM (
    SELECT question_id, MIN(ordem) AS min_ordem
    FROM prova_questoes
    WHERE prova_id = p_prova_id
    GROUP BY question_id
  ) sub;

  IF v_ordem_original IS NULL OR array_length(v_ordem_original, 1) IS NULL THEN
    RAISE EXCEPTION 'A prova não tem questões.';
  END IF;

  -- Sorteio novo: fora o que existia.
  DELETE FROM prova_versoes WHERE prova_id = p_prova_id;

  FOR v_i IN 1..v_prova.qtd_versoes LOOP
    v_rotulo := public.rotulo_versao_prova(v_i);

    IF v_i = 1 OR v_prova.embaralhar = 'NENHUM' THEN
      -- Versão A é a cópia de referência: nada é permutado nela.
      v_ordem := v_ordem_original;
      v_mapa := '{}'::jsonb;
    ELSE
      -- Embaralha garantindo exatamente os mesmos elementos, sem omissão nem repetição
      -- — mas dissertativa/redação nunca sai das primeiras posições: mantém a ordem
      -- original entre si (grupo 0), e só as objetivas (grupo 1) são sorteadas, sempre
      -- depois de todas as dissertativas.
      WITH tipos AS (
        SELECT o.qid, o.pos, q.tipo
        FROM unnest(v_ordem_original) WITH ORDINALITY AS o(qid, pos)
        JOIN questions q ON q.id = o.qid
      )
      SELECT array_agg(qid ORDER BY grupo, chave)
        INTO v_ordem
      FROM (
        SELECT DISTINCT ON (qid)
          qid,
          CASE WHEN tipo IN ('DISSERTATIVA', 'REDACAO') THEN 0 ELSE 1 END AS grupo,
          CASE WHEN tipo IN ('DISSERTATIVA', 'REDACAO') THEN pos::double precision ELSE random() END AS chave
        FROM tipos
      ) s;

      IF v_prova.embaralhar = 'QUESTOES_ALTERNATIVAS' THEN
        SELECT COALESCE(jsonb_object_agg(q.id::text, p.letras), '{}'::jsonb)
          INTO v_mapa
        FROM questions q
        CROSS JOIN LATERAL (
          SELECT jsonb_agg(alt->>'letter' ORDER BY random()) AS letras
          FROM jsonb_array_elements(q.alternatives) AS alt
        ) p
        WHERE q.id = ANY(v_ordem_original)
          AND q.tipo = 'OBJETIVA'
          AND jsonb_array_length(q.alternatives) > 1;
      ELSE
        v_mapa := '{}'::jsonb;
      END IF;
    END IF;

    INSERT INTO prova_versoes (prova_id, rotulo, ordem_questoes, mapa_alternativas)
    VALUES (p_prova_id, v_rotulo, v_ordem, v_mapa)
    RETURNING id INTO v_versao_id;

    v_versao_ids := v_versao_ids || v_versao_id;
  END LOOP;

  -- Distribuição em rodízio pela ordem de chamada
  INSERT INTO prova_alocacoes (prova_id, aluno_id, versao_id, codigo)
  SELECT
    p_prova_id,
    a.aluno_id,
    v_versao_ids[1 + (a.pos % v_prova.qtd_versoes)],
    public.gerar_codigo_alocacao()
  FROM (
    SELECT
      al.id AS aluno_id,
      (row_number() OVER (ORDER BY t.nome NULLS LAST, al.aluno_numero NULLS LAST, al.nome) - 1)::int AS pos
    FROM prova_turmas pt
    JOIN alunos al ON al.turma_id = pt.turma_id
    LEFT JOIN turmas t ON t.id = al.turma_id
    WHERE pt.prova_id = p_prova_id
      AND lower(coalesce(al.status, 'ativo')) NOT IN ('transferido', 'remanejado')
  ) a
  ON CONFLICT (prova_id, aluno_id) DO NOTHING;

  RETURN QUERY
  SELECT pv.rotulo, count(pa.id)::int
  FROM prova_versoes pv
  LEFT JOIN prova_alocacoes pa ON pa.versao_id = pv.id
  WHERE pv.prova_id = p_prova_id
  GROUP BY pv.id, pv.rotulo
  ORDER BY pv.rotulo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_gerar_versoes_prova(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
