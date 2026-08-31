-- ====================================================================================
-- RPC COMPLETA: Lista professores da área + suas alocações (turmas/disciplinas)
-- SECURITY DEFINER = ignora RLS de professores E turma_disciplina_professor
-- Execute no SQL Editor do Supabase
-- ====================================================================================

DROP FUNCTION IF EXISTS public.rpc_listar_professores_area(TEXT);
CREATE OR REPLACE FUNCTION public.rpc_listar_professores_area(p_area_conhecimento TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para listar professores da área.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',                       pr.id,
      'nome',                     pr.nome,
      'email',                    pr.email,
      'area_conhecimento',        pr.area_conhecimento,
      'config_visto_valor_total', pr.config_visto_valor_total,
      'alocacoes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id',              al.id,
          'turma_id',        al.turma_id,
          'turma_nome',      t.nome,
          'disciplina_id',   al.disciplina_id,
          'disciplina_nome', d.nome
        ))
        FROM alocacoes_v2 al
        JOIN turmas t ON t.id = al.turma_id
        JOIN disciplinas d ON d.id = al.disciplina_id
        WHERE al.professor_id = pr.id
      ), '[]'::jsonb)
    )
    ORDER BY pr.nome
  )
  INTO v_result
  FROM professores pr
  WHERE
    pr.area_conhecimento = p_area_conhecimento
    OR (p_area_conhecimento = 'Ciências Humanas'
        AND pr.area_conhecimento IN ('Humanas', 'Ciências Humanas', 'Educação Especial'))
    OR (p_area_conhecimento = 'Linguagens'
        AND pr.area_conhecimento IN ('Linguagens', 'Educação Profissional'));

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_professores_area(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_professores_area(TEXT) TO authenticated;
