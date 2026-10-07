-- Fix para Nota Ponderada: Utilizar o número de acertos em vez da pontuação bruta (r.nota)
-- como referência para o cálculo proporcional, atendendo ao pedido de que "o maior número de
-- acertos irá determinar quanto vale cada questão".

CREATE OR REPLACE FUNCTION public.rpc_recalcular_ponderada(p_prova_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_afetadas integer;
BEGIN
  IF NOT public.pode_corrigir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para recalcular as notas desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;

  IF v_prova.modo_nota <> 'PONDERADA' THEN
    UPDATE prova_respostas SET nota_ponderada = NULL WHERE prova_id = p_prova_id;
    RETURN 0;
  END IF;

  WITH base AS (
    SELECT
      r.id,
      (
        SELECT COALESCE(SUM(
          CASE 
            WHEN q.tipo IN ('DISSERTATIVA', 'REDACAO') THEN ri.valor_obtido
            WHEN ri.correta = true AND ri.anulada_manual = false THEN 1.0
            ELSE 0.0
          END
        ), 0.0)
        FROM prova_respostas_itens ri
        JOIN questions q ON q.id = ri.question_id
        WHERE ri.resposta_id = r.id
      ) AS pontos_referencia,
      CASE WHEN v_prova.ponderada_escopo = 'TURMA' THEN al.turma_id ELSE NULL END AS grupo
    FROM prova_respostas r
    JOIN alunos al ON al.id = r.aluno_id
    WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
  ),
  referencia AS (
    SELECT b.*, max(b.pontos_referencia) OVER (PARTITION BY b.grupo) AS topo FROM base b
  )
  UPDATE prova_respostas r
     SET nota_ponderada = CASE
       WHEN ref.topo IS NULL OR ref.topo <= 0 THEN 0
       ELSE round(v_prova.valor_total * ref.pontos_referencia / ref.topo, 2)
     END
  FROM referencia ref
  WHERE r.id = ref.id;

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  RETURN v_afetadas;
END;
$$;

-- Recalcula automaticamente as notas de todas as provas ponderadas existentes
DO \$\$
DECLARE
  v_prova RECORD;
BEGIN
  FOR v_prova IN SELECT id FROM public.provas WHERE modo_nota = 'PONDERADA'
  LOOP
    PERFORM public.rpc_recalcular_ponderada(v_prova.id);
  END LOOP;
END;
\$\$;

