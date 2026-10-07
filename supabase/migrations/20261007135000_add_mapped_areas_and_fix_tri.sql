-- Cria função helper para mapear a área da questão baseada nas cotas ou estrutura da avaliação geral
CREATE OR REPLACE FUNCTION public.rpc_mapear_areas_prova(p_prova_id UUID)
RETURNS TABLE (question_id UUID, area_conhecimento TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH area_ranges_geral AS (
    SELECT 
      prova_id, 
      public.prova_geral_areas.area_conhecimento AS area,
      ordem AS ordem_bloco,
      qtd_questoes
    FROM public.prova_geral_areas
    WHERE prova_id = p_prova_id
  ),
  area_ranges_cota AS (
    SELECT 
      pac.prova_id, 
      pac.area_conhecimento AS area,
      pac.ordem_bloco,
      pac.qtd_questoes
    FROM public.prova_area_cotas pac
    JOIN public.disciplinas d ON d.id = pac.disciplina_id
    WHERE pac.prova_id = p_prova_id
  ),
  area_ranges_combined AS (
    SELECT * FROM area_ranges_geral
    UNION ALL
    SELECT * FROM area_ranges_cota
  ),
  area_ranges AS (
    SELECT 
      prova_id, 
      area,
      COALESCE(SUM(qtd_questoes) OVER (PARTITION BY prova_id ORDER BY ordem_bloco ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) + 1 AS range_start,
      SUM(qtd_questoes) OVER (PARTITION BY prova_id ORDER BY ordem_bloco) AS range_end
    FROM area_ranges_combined
  ),
  questao_ordem AS (
    SELECT 
      pq.prova_id,
      pq.question_id,
      row_number() OVER (PARTITION BY pq.prova_id ORDER BY pq.ordem) as q_ordem
    FROM public.prova_questoes pq
    WHERE pq.prova_id = p_prova_id
  )
  SELECT 
    qo.question_id,
    ar.area
  FROM questao_ordem qo
  JOIN area_ranges ar 
    ON qo.prova_id = ar.prova_id 
   AND qo.q_ordem BETWEEN ar.range_start AND ar.range_end;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_mapear_areas_prova TO authenticated;

-- Atualiza a função de recálculo da nota ponderada e TRI para usar a nova função de mapeamento
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
  -- Se for uma chamada do sistema/migration (auth.uid() nulo), permite a execução
  IF auth.uid() IS NOT NULL AND NOT public.pode_corrigir_prova(p_prova_id) THEN
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
      COALESCE(ma.area_conhecimento, q.area) AS area,
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
    LEFT JOIN public.rpc_mapear_areas_prova(p_prova_id) ma ON ma.question_id = q.id
    WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
    GROUP BY r.id, al.turma_id, COALESCE(ma.area_conhecimento, q.area)
  ),
  estatisticas_areas AS (
    SELECT grupo, area, avg(pontos) as media, stddev_pop(pontos) as desvio_padrao
    FROM base_areas 
    WHERE area IS NOT NULL AND trim(area) <> '' AND area <> 'Sem Área'
    GROUP BY grupo, area
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

-- Recalcula imediatamente usando a nova função
DO $$
DECLARE
  v_prova RECORD;
BEGIN
  FOR v_prova IN SELECT id FROM public.provas WHERE modo_nota = 'PONDERADA'
  LOOP
    PERFORM public.rpc_recalcular_ponderada(v_prova.id);
  END LOOP;
END;
$$;
