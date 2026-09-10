-- ====================================================================================
-- NOTA DIGITADA À MÃO NO DIÁRIO (GradesPanel) NÃO SE ESPALHAVA PROS OUTROS
-- PROFESSORES DE UMA AVALIAÇÃO DE ÁREA
--
-- handleUpdateNota (GradesPanel.tsx) sempre fazia um upsert direto em notas_avaliacoes
-- só pro avaliacao_id do professor que estava editando — nunca soube que essa
-- avaliação podia ser uma AVALIAÇÃO DE ÁREA com um avaliacao_id por professor
-- (prova_avaliacao_notas). Isso é diferente do "Lançar notas" do Modo Correção (que já
-- espalha certo, via rpc_lancar_notas_boletim) — aqui é edição manual direto na
-- célula do diário, sem passar pela correção.
--
-- rpc_lancar_nota_manual_area: se o avaliacao_id editado for de uma avaliação de área,
-- propaga a mesma nota pra TODOS os avaliacao_id vinculados à mesma prova+turma (um por
-- professor da cota). Se algum já tiver nota diferente preenchida, recusa (mesmo
-- padrão de rpc_lancar_notas_boletim) a menos que p_confirmar_substituicao=true.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_lancar_nota_manual_area(
  p_avaliacao_id uuid,
  p_aluno_id uuid,
  p_nota numeric,
  p_confirmar_substituicao boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aval avaliacoes;
  v_prova_id uuid;
  v_turma_id uuid;
  v_nota_capada numeric;
  v_conflitos integer;
  v_lancadas integer;
BEGIN
  SELECT * INTO v_aval FROM avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação de nota não encontrada.';
  END IF;

  IF NOT (
    public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR EXISTS (
      SELECT 1 FROM professores prof
      WHERE prof.id = v_aval.professor_id AND prof.user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para lançar nota nesta avaliação.';
  END IF;

  v_nota_capada := GREATEST(0, LEAST(p_nota, v_aval.valor_maximo));

  -- Esta avaliação é de área? Acha o prova_id/turma_id pelo vínculo em
  -- prova_avaliacao_notas (criado na publicação — ver rpc_publicar_avaliacao_area).
  SELECT pan.prova_id, pan.turma_id INTO v_prova_id, v_turma_id
  FROM prova_avaliacao_notas pan
  WHERE pan.avaliacao_id = p_avaliacao_id
  LIMIT 1;

  IF v_prova_id IS NULL THEN
    -- Avaliação normal, sem vínculo de área: upsert direto, sem propagar.
    INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
    VALUES (p_avaliacao_id, p_aluno_id, v_nota_capada)
    ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;
    RETURN jsonb_build_object('nota', v_nota_capada, 'propagada', false, 'professores', 1);
  END IF;

  -- Quantos OUTROS avaliacao_id (outros professores desta mesma prova+turma) já têm
  -- nota diferente preenchida pra este aluno — mesmo critério de
  -- rpc_lancar_notas_boletim: nota igual não é substituição de verdade.
  SELECT count(*) INTO v_conflitos
  FROM prova_avaliacao_notas pan
  JOIN notas_avaliacoes na ON na.avaliacao_id = pan.avaliacao_id AND na.aluno_id = p_aluno_id
  WHERE pan.prova_id = v_prova_id
    AND pan.turma_id = v_turma_id
    AND pan.avaliacao_id <> p_avaliacao_id
    AND na.nota IS NOT NULL
    AND na.nota IS DISTINCT FROM v_nota_capada;

  IF v_conflitos > 0 AND NOT p_confirmar_substituicao THEN
    RAISE EXCEPTION 'CONFIRMACAO_SUBSTITUICAO:% outro(s) professor(es) já tinha(m) nota diferente lançada pra este aluno.', v_conflitos;
  END IF;

  -- Propaga pra todo avaliacao_id vinculado à mesma prova+turma (inclusive o de quem
  -- está editando), cada um capado no próprio valor_maximo.
  WITH alvos AS (
    SELECT pan.avaliacao_id, LEAST(v_nota_capada, a2.valor_maximo) AS nota_capada
    FROM prova_avaliacao_notas pan
    JOIN avaliacoes a2 ON a2.id = pan.avaliacao_id
    WHERE pan.prova_id = v_prova_id AND pan.turma_id = v_turma_id
  )
  INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
  SELECT alvos.avaliacao_id, p_aluno_id, alvos.nota_capada FROM alvos
  ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

  GET DIAGNOSTICS v_lancadas = ROW_COUNT;

  RETURN jsonb_build_object('nota', v_nota_capada, 'propagada', true, 'professores', v_lancadas);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_lancar_nota_manual_area(uuid, uuid, numeric, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_lancar_nota_manual_area(uuid, uuid, numeric, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
