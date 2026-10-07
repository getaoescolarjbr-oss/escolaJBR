-- Adiciona a coluna nota_tri na tabela prova_respostas
ALTER TABLE public.prova_respostas ADD COLUMN IF NOT EXISTS nota_tri numeric;

-- Atualiza a função rpc_recalcular_ponderada para também calcular o escore padronizado (TRI/UFMS)
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
    UPDATE prova_respostas SET nota_ponderada = NULL, nota_tri = NULL WHERE prova_id = p_prova_id;
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
  estatisticas AS (
    SELECT 
      grupo,
      avg(pontos_referencia) as media,
      -- stddev_samp requires at least 2 rows. If only 1 student, it's null.
      -- stddev_pop is 0 if 1 student. We use stddev_pop to avoid nulls when possible.
      stddev_pop(pontos_referencia) as desvio_padrao
    FROM base
    GROUP BY grupo
  ),
  referencia AS (
    SELECT 
      b.*, 
      e.media, 
      NULLIF(e.desvio_padrao, 0) as desvio_padrao,
      max(b.pontos_referencia) OVER (PARTITION BY b.grupo) AS topo 
    FROM base b
    LEFT JOIN estatisticas e ON b.grupo IS NOT DISTINCT FROM e.grupo
  )
  UPDATE prova_respostas r
     SET 
       nota_ponderada = CASE
         WHEN ref.topo IS NULL OR ref.topo <= 0 THEN 0
         ELSE round(v_prova.valor_total * ref.pontos_referencia / ref.topo, 2)
       END,
       -- Cálculo do Escore Padronizado (estilo TRI Simulada / UFMS)
       -- EP = 500 + 100 * ((Acertos - Media) / DesvioPadrao)
       nota_tri = CASE 
         WHEN ref.desvio_padrao IS NULL THEN 500.00 -- Se não houver desvio padrão (ex: 1 aluno só ou todos com a mesma nota)
         ELSE round(500.0 + 100.0 * ((ref.pontos_referencia - ref.media) / ref.desvio_padrao), 2)
       END
  FROM referencia ref
  WHERE r.id = ref.id;

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  RETURN v_afetadas;
END;
$$;
