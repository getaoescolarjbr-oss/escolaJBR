-- Adiciona a coluna nota_tri_areas na tabela prova_respostas
ALTER TABLE public.prova_respostas ADD COLUMN IF NOT EXISTS nota_tri_areas jsonb;

-- Atualiza a função rpc_recalcular_ponderada para também calcular o escore padronizado por área
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
    UPDATE prova_respostas SET nota_ponderada = NULL, nota_tri = NULL, nota_tri_areas = NULL WHERE prova_id = p_prova_id;
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
  ),
  base_areas AS (
    SELECT
      r.id AS resposta_id,
      CASE WHEN v_prova.ponderada_escopo = 'TURMA' THEN al.turma_id ELSE NULL END AS grupo,
      COALESCE(q.area, 'Sem Área') AS area,
      COALESCE(SUM(
        CASE 
          WHEN q.tipo IN ('DISSERTATIVA', 'REDACAO') THEN ri.valor_obtido
          WHEN ri.correta = true AND ri.anulada_manual = false THEN 1.0
          ELSE 0.0
        END
      ), 0.0) AS pontos
    FROM prova_respostas r
    JOIN alunos al ON al.id = r.aluno_id
    JOIN prova_respostas_itens ri ON ri.resposta_id = r.id
    JOIN questions q ON q.id = ri.question_id
    WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
    GROUP BY r.id, al.turma_id, COALESCE(q.area, 'Sem Área')
  ),
  estatisticas_areas AS (
    SELECT grupo, area, avg(pontos) as media, stddev_pop(pontos) as desvio_padrao
    FROM base_areas GROUP BY grupo, area
  ),
  tri_areas AS (
    SELECT 
      b.resposta_id,
      b.area,
      CASE 
        WHEN e.desvio_padrao IS NULL OR e.desvio_padrao = 0 THEN 500.00
        ELSE round(500.0 + 100.0 * ((b.pontos - e.media) / e.desvio_padrao), 2)
      END AS nota_tri
    FROM base_areas b
    JOIN estatisticas_areas e ON b.grupo IS NOT DISTINCT FROM e.grupo AND b.area = e.area
  ),
  tri_json AS (
    SELECT resposta_id, jsonb_object_agg(area, nota_tri) AS nota_tri_areas
    FROM tri_areas GROUP BY resposta_id
  )
  UPDATE prova_respostas r
     SET 
       nota_ponderada = CASE
         WHEN ref.topo IS NULL OR ref.topo <= 0 THEN 0
         ELSE round(v_prova.valor_total * ref.pontos_referencia / ref.topo, 2)
       END,
       nota_tri = CASE 
         WHEN ref.desvio_padrao IS NULL THEN 500.00
         ELSE round(500.0 + 100.0 * ((ref.pontos_referencia - ref.media) / ref.desvio_padrao), 2)
       END,
       nota_tri_areas = tj.nota_tri_areas
  FROM referencia ref
  LEFT JOIN tri_json tj ON tj.resposta_id = ref.id
  WHERE r.id = ref.id;

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  RETURN v_afetadas;
END;
$$;
