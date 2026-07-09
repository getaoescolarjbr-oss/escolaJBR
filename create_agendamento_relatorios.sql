-- ====================================================================================
-- MÓDULO AGENDAMENTO — Etapa 6: relatórios (Coordenação/Gestão).
-- Execute no Painel do Supabase > SQL Editor, depois de create_agendamento_schema.sql.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_relatorio_agendamento(p_data_inicio DATE, p_data_fim DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_dias_uteis INTEGER;
  v_horas_uteis_periodo NUMERIC;
BEGIN
  IF NOT (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para consultar relatórios de agendamento.' USING ERRCODE = '42501';
  END IF;

  -- Dias úteis (seg-sex) no período — usado como referência de "horas disponíveis"
  -- para calcular taxa de ocupação aproximada (8 períodos de aula ~50min = 6h40/dia).
  -- É uma referência declarada, não uma grade horária real (nenhuma existe no banco).
  SELECT count(*) INTO v_dias_uteis
  FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') d
  WHERE extract(isodow FROM d) BETWEEN 1 AND 5;

  v_horas_uteis_periodo := v_dias_uteis * (400.0 / 60.0); -- 8 períodos x 50min = 400min/dia

  WITH reservas_periodo AS (
    SELECT r.*, EXTRACT(EPOCH FROM (r.hora_fim - r.hora_inicio)) / 3600.0 AS horas
    FROM reservas r
    WHERE r.data BETWEEN p_data_inicio AND p_data_fim
  ),
  por_recurso AS (
    SELECT
      rec.id, rec.nome,
      count(*) FILTER (WHERE rp.status = 'CONFIRMADA') AS total_reservas,
      COALESCE(SUM(rp.horas) FILTER (WHERE rp.status = 'CONFIRMADA'), 0) AS horas_reservadas
    FROM recursos rec
    LEFT JOIN reservas_periodo rp ON rp.recurso_id = rec.id
    GROUP BY rec.id, rec.nome
  ),
  picos AS (
    SELECT hora_inicio, count(*) AS total
    FROM reservas_periodo
    WHERE status = 'CONFIRMADA'
    GROUP BY hora_inicio
    ORDER BY total DESC
    LIMIT 5
  ),
  por_professor AS (
    SELECT p.id, p.nome, count(*) AS total_reservas
    FROM reservas_periodo rp
    JOIN professores p ON p.id = rp.professor_id
    WHERE rp.status = 'CONFIRMADA'
    GROUP BY p.id, p.nome
    ORDER BY total_reservas DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'periodo_dias_uteis', v_dias_uteis,
    'horas_uteis_periodo_por_recurso', v_horas_uteis_periodo,
    'por_recurso', (
      SELECT jsonb_agg(jsonb_build_object(
        'recurso_id', id, 'nome', nome, 'total_reservas', total_reservas,
        'horas_reservadas', round(horas_reservadas::numeric, 1),
        'taxa_ocupacao', CASE WHEN v_horas_uteis_periodo > 0 THEN round((horas_reservadas / v_horas_uteis_periodo * 100)::numeric, 1) ELSE 0 END
      ) ORDER BY horas_reservadas DESC)
      FROM por_recurso
    ),
    'horarios_pico', (SELECT jsonb_agg(jsonb_build_object('hora_inicio', hora_inicio, 'total', total)) FROM picos),
    'por_professor', (SELECT jsonb_agg(jsonb_build_object('professor_id', id, 'nome', nome, 'total_reservas', total_reservas)) FROM por_professor)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_relatorio_agendamento(DATE, DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_relatorio_agendamento(DATE, DATE) TO authenticated;
