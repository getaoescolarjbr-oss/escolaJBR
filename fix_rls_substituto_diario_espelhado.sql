-- ====================================================================================
-- PROFESSOR SUBSTITUTO NÃO CONSEGUIA LANÇAR NOTAS NO DIÁRIO ESPELHADO
--
-- A tabela `avaliacoes` (módulo de notas — GradesPanel.tsx) NÃO tem RLS habilitado
-- (foi desligada em fix_provas_table_collision.sql para evitar conflito com o gerador
-- de provas). Portanto o único bloqueio de banco é a permissão interna da função
-- rpc_lancar_nota_manual_area, que exige prof.user_id = auth.uid() onde
-- prof.id = avaliacao.professor_id.
--
-- Quando o substituto lança nota, o app usa professor_id = titular.id (correto, para
-- manter o diário no titular), mas o substituto está logado como ele mesmo. A checagem
-- falha com "Sem permissão para lançar nota nesta avaliação."
--
-- Correção: aceitar também quem tem alocacoes_v2.is_espelho = true vigente para a
-- turma da avaliação (mesmo padrão de autorização de rpc_minhas_substituicoes).
--
-- Reverter:
--   Restaurar rpc_lancar_nota_manual_area sem o bloco EXISTS de espelho (ver
--   add_rpc_lancar_nota_manual_area.sql).
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

  -- Permissão: dono da avaliação (prof.user_id = auth.uid()), GESTAO, COORDENACAO,
  -- ou substituto com espelho ativo (is_espelho=true) na turma da avaliação hoje.
  IF NOT (
    public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('COORDENACAO')
    OR EXISTS (
      SELECT 1 FROM professores prof
      WHERE prof.id = v_aval.professor_id AND prof.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM alocacoes_v2 esp
      JOIN atestados_servidores s ON s.id = esp.atestado_id
      WHERE esp.professor_id = (SELECT public.meu_professor_id())
        AND esp.is_espelho = true
        AND s.ativo = true
        AND (now() AT TIME ZONE 'America/Campo_Grande')::date
            BETWEEN s.data_inicio AND s.data_fim
        AND esp.turma_id::text = v_aval.turma_id::text
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
