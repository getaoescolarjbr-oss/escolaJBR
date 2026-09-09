-- ====================================================================================
-- CORREÇÃO DISSERTATIVA/REDAÇÃO: MESMA LACUNA DE PERMISSÃO DA CORREÇÃO POR OMR
--
-- rpc_itens_pendentes_correcao e rpc_corrigir_item_dissertativo só liberavam o CRIADOR
-- da prova ou GESTAO/COORDENACAO — faltava COORDENACAO_AREA e qualquer professor com
-- cota na avaliação de área (mesma lacuna já corrigida nas RPCs de OMR em
-- add_correcao_area_qualquer_professor.sql, usando pode_corrigir_prova()). Sem isso,
-- "Corrigir dissertativas" dava "Não foi possível carregar as respostas para correção"
-- pra quem não fosse o criador exato da prova — e a nota da questão aberta, dentro do
-- Modo Correção, nunca aparecia (o erro era engolido em silêncio ali).
-- ====================================================================================

DROP FUNCTION IF EXISTS public.rpc_itens_pendentes_correcao(uuid);

CREATE FUNCTION public.rpc_itens_pendentes_correcao(p_prova_id uuid)
RETURNS TABLE (
  item_id            uuid,
  resposta_id        uuid,
  aluno_id           uuid,
  aluno_nome         text,
  turma_nome         text,
  question_id        uuid,
  ordem              integer,
  valor              numeric,
  tipo               text,
  statement          text,
  criterios_correcao text,
  linhas_resposta    integer,
  resposta_texto     text,
  finalizado_em      timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_corrigir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta avaliação.';
  END IF;

  RETURN QUERY
  SELECT
    ri.id, r.id, al.id, al.nome, t.nome,
    q.id, pq.ordem, pq.valor, q.tipo, q.statement,
    q.criterios_correcao, q.linhas_resposta,
    ri.resposta_texto, r.finalizado_em
  FROM prova_respostas_itens ri
  JOIN prova_respostas r ON r.id = ri.resposta_id
  JOIN questions q       ON q.id = ri.question_id
  JOIN prova_questoes pq ON pq.prova_id = r.prova_id AND pq.question_id = q.id
  JOIN alunos al         ON al.id = r.aluno_id
  LEFT JOIN turmas t     ON t.id = al.turma_id
  WHERE r.prova_id = p_prova_id
    AND ri.corrigido = false
    AND q.tipo IN ('DISSERTATIVA', 'REDACAO')
  ORDER BY pq.ordem, al.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_itens_pendentes_correcao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_itens_pendentes_correcao(uuid) TO authenticated;


DROP FUNCTION IF EXISTS public.rpc_corrigir_item_dissertativo(uuid, numeric, text);

CREATE FUNCTION public.rpc_corrigir_item_dissertativo(
  p_item_id      uuid,
  p_valor_obtido numeric,
  p_observacao   text DEFAULT NULL
)
RETURNS TABLE (
  item_id         uuid,
  resposta_id     uuid,
  valor_obtido    numeric,
  nota_resposta   numeric,
  status_correcao text,
  ainda_pendentes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resposta_id uuid;
  v_prova_id    uuid;
  v_valor_max   numeric;
  v_tipo        text;
  v_nota        numeric;
  v_status      text;
  v_pendentes   integer;
BEGIN
  SELECT r.id, r.prova_id, pq.valor, q.tipo
    INTO v_resposta_id, v_prova_id, v_valor_max, v_tipo
  FROM prova_respostas_itens ri
  JOIN prova_respostas r ON r.id = ri.resposta_id
  JOIN questions q       ON q.id = ri.question_id
  JOIN prova_questoes pq ON pq.prova_id = r.prova_id AND pq.question_id = q.id
  WHERE ri.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de resposta não encontrado.';
  END IF;

  IF NOT public.pode_corrigir_prova(v_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta avaliação.';
  END IF;

  IF v_tipo NOT IN ('DISSERTATIVA', 'REDACAO') THEN
    RAISE EXCEPTION 'Este item é de questão objetiva e é corrigido automaticamente.';
  END IF;

  IF p_valor_obtido IS NULL OR p_valor_obtido < 0 OR p_valor_obtido > v_valor_max THEN
    RAISE EXCEPTION 'A nota deve estar entre 0 e % (valor da questão nesta prova).', v_valor_max;
  END IF;

  UPDATE prova_respostas_itens
     SET valor_obtido         = p_valor_obtido,
         observacao_professor = p_observacao,
         corrigido            = true,
         corrigido_por        = auth.uid(),
         corrigido_em         = now(),
         correta              = (v_valor_max > 0 AND p_valor_obtido >= v_valor_max)
   WHERE id = p_item_id;

  v_nota := public.recalcular_nota_prova_resposta(v_resposta_id);

  SELECT r.status_correcao INTO v_status
    FROM prova_respostas r WHERE r.id = v_resposta_id;
  SELECT count(*) INTO v_pendentes
    FROM prova_respostas_itens ri
   WHERE ri.resposta_id = v_resposta_id AND ri.corrigido = false;

  RETURN QUERY SELECT p_item_id, v_resposta_id, p_valor_obtido, v_nota, v_status, v_pendentes;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_corrigir_item_dissertativo(uuid, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_corrigir_item_dissertativo(uuid, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
