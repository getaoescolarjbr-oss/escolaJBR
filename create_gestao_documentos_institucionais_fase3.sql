-- ====================================================================================
-- DOCUMENTOS INSTITUCIONAIS — Etapa 3: aprovação/promoção a vigente (RPCs já
-- existentes desde a Etapa 1) + gancho com o Colegiado nas telas.
--
-- Gap real achado ao montar o seletor de "órgão aprovador" na tela de promoção:
-- orgaos_colegiados só tem SELECT para GESTAO ou membro do próprio órgão
-- (create_gestao_governanca_schema.sql) — COORDENACAO, que TAMBÉM aprova PPP/
-- Regimento aqui, não conseguiria listar órgãos pra escolher. Confirmado ao vivo:
-- COORDENACAO via 0 órgãos antes desta correção. RPC mínima (id+nome+tipo, não abre
-- membros/mandatos/CNPJ), sem alterar a RLS mais restrita do módulo de Governança.
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.rpc_listar_orgaos_para_selecao()
RETURNS TABLE (id UUID, nome TEXT, tipo TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT o.id, o.nome, o.tipo FROM orgaos_colegiados o WHERE o.ativo = true ORDER BY o.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_orgaos_para_selecao() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_orgaos_para_selecao() TO authenticated;
