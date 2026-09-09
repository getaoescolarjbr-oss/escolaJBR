-- ====================================================================================
-- AVISAR ANTES DE SUBSTITUIR UMA NOTA JÁ PREENCHIDA AO LANÇAR NO BOLETIM
--
-- rpc_lancar_notas_boletim fazia UPSERT direto: se algum professor já tinha digitado
-- uma nota manualmente pro aluno (ex.: caso especial, revisão, recurso), lançar por
-- cima sem aviso apagava esse ajuste manual em silêncio. Agora, se já existir nota
-- DIFERENTE da que vai ser lançada, a função recusa (RAISE de um erro num formato
-- reconhecível) a menos que p_confirmar_substituicao = true — o cliente pega esse erro
-- específico, pergunta ao professor, e chama de novo com true se ele confirmar.
-- ====================================================================================

DROP FUNCTION IF EXISTS public.rpc_lancar_notas_boletim(uuid);

CREATE OR REPLACE FUNCTION public.rpc_lancar_notas_boletim(
  p_prova_id uuid,
  p_confirmar_substituicao boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_lancadas integer;
  v_conflitos integer;
BEGIN
  IF NOT public.pode_corrigir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para lançar as notas desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;
  IF v_prova.modo_nota = 'SEM_NOTA' THEN
    RAISE EXCEPTION 'Esta prova está configurada como "sem nota" — ela gera relatório, mas não vai para o boletim.';
  END IF;
  IF NOT v_prova.lancar_no_boletim THEN
    RAISE EXCEPTION 'Esta prova está marcada para não lançar nota no boletim.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM prova_avaliacao_notas WHERE prova_id = p_prova_id) THEN
    RAISE EXCEPTION 'Esta prova ainda não tem avaliação de nota vinculada. Confira se disciplina e bimestre foram preenchidos ao publicar.';
  END IF;

  IF v_prova.modo_nota = 'PONDERADA' THEN
    PERFORM public.rpc_recalcular_ponderada(p_prova_id);
  END IF;

  -- Quantos lançamentos vão SUBSTITUIR uma nota já preenchida e DIFERENTE da que sairia
  -- agora. Nota igual à que já está lá não conta como conflito — relançar em cima do
  -- mesmo valor não é uma "substituição" de verdade.
  SELECT count(*) INTO v_conflitos
  FROM prova_respostas r
  JOIN alunos al ON al.id = r.aluno_id
  JOIN prova_avaliacao_notas pan ON pan.prova_id = p_prova_id AND pan.turma_id = al.turma_id
  JOIN notas_avaliacoes na ON na.avaliacao_id = pan.avaliacao_id AND na.aluno_id = r.aluno_id
  WHERE r.prova_id = p_prova_id
    AND r.finalizado_em IS NOT NULL
    AND na.nota IS NOT NULL
    AND na.nota IS DISTINCT FROM (
      CASE WHEN v_prova.modo_nota = 'PONDERADA' THEN COALESCE(r.nota_ponderada, 0) ELSE COALESCE(r.nota, 0) END
    );

  IF v_conflitos > 0 AND NOT p_confirmar_substituicao THEN
    -- Prefixo fixo pra o cliente reconhecer sem depender do texto inteiro da frase.
    RAISE EXCEPTION 'CONFIRMACAO_SUBSTITUICAO:% nota(s) já preenchida(s) seria(m) substituída(s). Chame de novo confirmando para continuar.', v_conflitos;
  END IF;

  INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
  SELECT
    pan.avaliacao_id,
    r.aluno_id,
    CASE WHEN v_prova.modo_nota = 'PONDERADA' THEN COALESCE(r.nota_ponderada, 0) ELSE COALESCE(r.nota, 0) END
  FROM prova_respostas r
  JOIN alunos al ON al.id = r.aluno_id
  JOIN prova_avaliacao_notas pan ON pan.prova_id = p_prova_id AND pan.turma_id = al.turma_id
  WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
  ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

  GET DIAGNOSTICS v_lancadas = ROW_COUNT;
  RETURN v_lancadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_lancar_notas_boletim(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
