-- ====================================================================================
-- GOVERNANÇA COLEGIADA — Etapa 3: reuniões + atas (via motor 5a) + deliberações.
--
-- Correção de um gap real da Etapa 2, achado ao desenhar as telas de reunião: a lista
-- de membros de um órgão precisa mostrar o NOME da pessoa, mas `pessoas` tem SELECT
-- restrito a GESTAO/SECRETARIA (create_fundacao_perfil_rls.sql) — COORDENACAO, que
-- também acessa este painel (RBAC: "COORDENACAO/SECRETARIA podem apoiar em
-- comunicação"), não conseguiria ler `pessoas` diretamente. A tela de Etapa 2
-- (OrgaosTab.tsx) só resolvia nome via resultado de busca — depois de recarregar a
-- página, membros já cadastrados apareciam como "Pessoa" (fallback), não o nome real.
-- Corrigido com uma RPC mínima (só id+nome, nunca CPF/telefone/email — minimização),
-- escopada aos membros de um órgão específico, não uma busca geral de pessoas.
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.rpc_nomes_membros_colegiado(p_orgao_id UUID)
RETURNS TABLE (pessoa_id UUID, nome TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nome
  FROM membros_colegiado mc
  JOIN pessoas p ON p.id = mc.pessoa_id
  WHERE mc.orgao_id = p_orgao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_nomes_membros_colegiado(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_nomes_membros_colegiado(UUID) TO authenticated;
