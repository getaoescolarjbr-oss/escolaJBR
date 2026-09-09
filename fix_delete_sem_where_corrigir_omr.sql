-- ====================================================================================
-- CORRIGE "DELETE requires a WHERE clause" NA CORREÇÃO POR OMR
--
-- add_anulacao_manual_item_prova.sql criou uma tabela temporária pra preservar
-- anulações manuais durante o reprocessamento de um cartão, e a limpava com
-- `DELETE FROM _anuladas_preservar;` sem WHERE (intencional — é uma limpeza total da
-- tabela, não um filtro). O projeto Supabase tem a extensão pg_safeupdate ativa, que
-- bloqueia QUALQUER DELETE sem WHERE — mesmo um de propósito, mesmo dentro de uma
-- função — e é exatamente isso que aparecia como "DELETE requires a WHERE clause" ao
-- corrigir qualquer cartão (a função nunca chegava a gravar a resposta).
--
-- A linha nem precisava existir: a tabela é `ON COMMIT DROP`, então cada chamada da
-- RPC (cada uma sua própria transação) já começa com a tabela recriada vazia. Só
-- remove a linha — nada de comportamento muda.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_corrigir_omr(p_codigo text, p_marcacoes jsonb, p_origem text DEFAULT 'CAMERA')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova_id uuid;
  v_aluno_id uuid;
  v_alocacao_id uuid;
  v_versao prova_versoes;
  v_prova provas;
  v_resposta_id uuid;
  v_acertos integer := 0;
  v_erros integer := 0;
  v_brancos integer := 0;
  v_anuladas integer := 0;
  v_total_linhas integer;
  v_nota numeric;
BEGIN
  IF p_origem NOT IN ('CAMERA', 'MANUAL') THEN
    RAISE EXCEPTION 'Origem inválida.';
  END IF;
  IF jsonb_typeof(p_marcacoes) <> 'array' THEN
    RAISE EXCEPTION 'As marcações devem vir como lista.';
  END IF;

  SELECT pa.id, pa.prova_id, pa.aluno_id INTO v_alocacao_id, v_prova_id, v_aluno_id
  FROM prova_alocacoes pa WHERE pa.codigo = upper(trim(p_codigo));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código não encontrado. Confira se o cartão é desta prova.';
  END IF;

  IF NOT public.pode_corrigir_prova(v_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = v_prova_id;
  IF v_prova.status = 'RASCUNHO' THEN
    RAISE EXCEPTION 'Publique a prova antes de corrigir os cartões.';
  END IF;

  SELECT pv.* INTO v_versao FROM prova_versoes pv
  JOIN prova_alocacoes pa ON pa.versao_id = pv.id
  WHERE pa.id = v_alocacao_id;

  SELECT count(*) INTO v_total_linhas FROM public.linhas_cartao_versao(v_versao.id);

  IF jsonb_array_length(p_marcacoes) <> v_total_linhas THEN
    RAISE EXCEPTION 'A leitura trouxe % linhas, mas o cartão da versão % tem %.',
      jsonb_array_length(p_marcacoes), v_versao.rotulo, v_total_linhas;
  END IF;

  INSERT INTO prova_respostas (prova_id, aluno_id)
  VALUES (v_prova_id, v_aluno_id)
  ON CONFLICT (prova_id, aluno_id) DO UPDATE SET prova_id = EXCLUDED.prova_id
  RETURNING id INTO v_resposta_id;

  -- Guarda quem estava anulado manualmente antes de apagar os itens objetivos. Tabela
  -- ON COMMIT DROP: já nasce vazia a cada chamada, não precisa (e não pode, por causa
  -- do pg_safeupdate) de um DELETE sem filtro pra "limpar" antes de usar.
  CREATE TEMP TABLE IF NOT EXISTS _anuladas_preservar (question_id uuid) ON COMMIT DROP;
  INSERT INTO _anuladas_preservar (question_id)
  SELECT ri.question_id
  FROM prova_respostas_itens ri
  JOIN public.linhas_cartao_versao(v_versao.id) l ON l.question_id = ri.question_id
  WHERE ri.resposta_id = v_resposta_id AND ri.anulada_manual = true;

  DELETE FROM prova_respostas_itens ri
  USING public.linhas_cartao_versao(v_versao.id) l
  WHERE ri.resposta_id = v_resposta_id AND ri.question_id = l.question_id;

  WITH lidas AS (
    SELECT
      l.question_id,
      l.correct_letter,
      m.bolha,
      public.bolha_para_alternativa(m.bolha, l.mapa, l.qtd_alternativas) AS letra_original
    FROM public.linhas_cartao_versao(v_versao.id) l
    JOIN LATERAL (
      SELECT upper(trim(COALESCE(x.valor, ''))) AS bolha
      FROM jsonb_array_elements_text(p_marcacoes) WITH ORDINALITY AS x(valor, pos)
      WHERE x.pos = l.linha
    ) m ON true
  )
  INSERT INTO prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido, corrigido, corrigido_por, corrigido_em)
  SELECT
    v_resposta_id,
    li.question_id,
    li.bolha,
    li.letra_original IS NOT NULL AND li.letra_original = li.correct_letter,
    CASE WHEN li.letra_original IS NOT NULL AND li.letra_original = li.correct_letter
         THEN COALESCE(pq.valor, 0) ELSE 0 END,
    true,
    auth.uid(),
    now()
  FROM lidas li
  LEFT JOIN prova_questoes pq ON pq.prova_id = v_prova_id AND pq.question_id = li.question_id;

  -- Reaplica a anulação manual preservada por cima da releitura: mesma questão continua
  -- zerada, mesmo que a nova leitura tenha achado a bolha certa.
  UPDATE prova_respostas_itens ri
     SET anulada_manual = true, valor_obtido = 0
    FROM _anuladas_preservar ap
   WHERE ri.resposta_id = v_resposta_id AND ri.question_id = ap.question_id;

  INSERT INTO prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido, corrigido)
  SELECT v_resposta_id, q.id, NULL, false, 0, false
  FROM unnest(v_versao.ordem_questoes) AS qid
  JOIN questions q ON q.id = qid
  WHERE q.tipo IN ('DISSERTATIVA', 'REDACAO')
  ON CONFLICT (resposta_id, question_id) DO NOTHING;

  SELECT
    count(*) FILTER (WHERE ri.correta)::int,
    count(*) FILTER (WHERE NOT ri.correta AND ri.letra_marcada IN ('A','B','C','D','E'))::int,
    count(*) FILTER (WHERE ri.letra_marcada IS NULL OR ri.letra_marcada = '')::int,
    count(*) FILTER (WHERE ri.letra_marcada = '*')::int
  INTO v_acertos, v_erros, v_brancos, v_anuladas
  FROM prova_respostas_itens ri
  JOIN public.linhas_cartao_versao(v_versao.id) l ON l.question_id = ri.question_id
  WHERE ri.resposta_id = v_resposta_id;

  UPDATE prova_respostas SET finalizado_em = COALESCE(finalizado_em, now()) WHERE id = v_resposta_id;

  v_nota := public.recalcular_nota_prova_resposta(v_resposta_id);

  INSERT INTO prova_leituras (prova_id, aluno_id, alocacao_id, marcacoes, origem, lido_por)
  VALUES (v_prova_id, v_aluno_id, v_alocacao_id, p_marcacoes, p_origem, auth.uid());

  IF v_prova.modo_nota = 'PONDERADA' THEN
    PERFORM public.rpc_recalcular_ponderada(v_prova_id);
    SELECT nota_ponderada INTO v_nota FROM prova_respostas WHERE id = v_resposta_id;
  END IF;

  RETURN jsonb_build_object(
    'aluno_id', v_aluno_id,
    'prova_id', v_prova_id,
    'versao', v_versao.rotulo,
    'acertos', v_acertos,
    'erros', v_erros,
    'em_branco', v_brancos,
    'anuladas', v_anuladas,
    'total_linhas', v_total_linhas,
    'nota', v_nota,
    'valor_total', v_prova.valor_total,
    'modo_nota', v_prova.modo_nota
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_corrigir_omr(text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_corrigir_omr(text, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
