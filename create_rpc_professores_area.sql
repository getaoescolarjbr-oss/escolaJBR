-- ====================================================================================
-- RPC: Lista professores da área de conhecimento para o Coordenador de Área
-- SECURITY DEFINER garante acesso mesmo com RLS restritivo na tabela professores
-- Execute no SQL Editor do Supabase
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_listar_professores_area(p_area_conhecimento TEXT)
RETURNS TABLE (
  id                       UUID,
  nome                     TEXT,
  email                    TEXT,
  area_conhecimento        TEXT,
  config_visto_valor_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas coordenadores de área, coordenação geral ou gestão podem ver a lista
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para listar professores da área.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pr.id,
    pr.nome,
    pr.email,
    pr.area_conhecimento,
    pr.config_visto_valor_total
  FROM professores pr
  WHERE pr.area_conhecimento = p_area_conhecimento
     OR (
       -- Normalização: 'Humanas' = 'Ciências Humanas'
       p_area_conhecimento = 'Ciências Humanas'
       AND pr.area_conhecimento IN ('Humanas', 'Ciências Humanas', 'Educação Especial')
     )
     OR (
       -- Normalização: 'Linguagens' inclui 'Educação Profissional'
       p_area_conhecimento = 'Linguagens'
       AND pr.area_conhecimento IN ('Linguagens', 'Educação Profissional')
     )
  ORDER BY pr.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_professores_area(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_professores_area(TEXT) TO authenticated;
