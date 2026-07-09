-- ====================================================================================
-- COZINHA (PNAE) — Fase 4: conciliação servido × matriculado. NUTRICAO não tem SELECT
-- direto em `matriculas` (RLS restringe a GESTAO/SECRETARIA), então a RPC precisa ser
-- SECURITY DEFINER pra cruzar os dois módulos sem abrir `matriculas` de forma geral.
--
-- O "Censo" (número oficial reportado ao INEP) fica de fora do cálculo automático — é
-- um dado externo, que a Secretaria/SED-MS registra fora deste sistema (mesmo ponto já
-- sinalizado como pendente de confirmação externa na etapa de fechamento da spec
-- original: códigos oficiais Censo/INEP). O relatório aqui cobre a parte que dá pra
-- calcular com dados internos: servido × matriculado.
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.rpc_conciliacao_pnae(p_data_inicio DATE, p_data_fim DATE)
RETURNS TABLE (
  data DATE,
  turno TEXT,
  quantidade_servida INTEGER,
  quantidade_matriculada INTEGER,
  divergencia INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO')) THEN
    RAISE EXCEPTION 'Sem permissão para consultar a conciliação da Cozinha.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.data,
    c.turno,
    COALESCE(rs.quantidade_alunos, 0)::INTEGER AS quantidade_servida,
    COALESCE(m.quantidade_matriculada, 0)::INTEGER AS quantidade_matriculada,
    (COALESCE(rs.quantidade_alunos, 0) - COALESCE(m.quantidade_matriculada, 0))::INTEGER AS divergencia
  FROM cardapios c
  LEFT JOIN refeicoes_servidas rs ON rs.cardapio_id = c.id
  LEFT JOIN (
    SELECT mat.ano_letivo AS mat_ano_letivo, mat.turno AS mat_turno, count(*) AS quantidade_matriculada
    FROM matriculas mat
    WHERE mat.status_matricula = 'ATIVA'
    GROUP BY mat.ano_letivo, mat.turno
  ) m ON m.mat_ano_letivo = extract(year FROM c.data)::int AND m.mat_turno = c.turno
  WHERE c.data BETWEEN p_data_inicio AND p_data_fim
  ORDER BY c.data, c.turno;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_conciliacao_pnae(DATE, DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_conciliacao_pnae(DATE, DATE) TO authenticated;
