-- ====================================================================================
-- Lista as tabelas do schema public — usada pela Edge Function de backup pra saber
-- o que exportar sem precisar manter uma lista fixa no código (toda tabela nova
-- criada no futuro já entra automaticamente no backup).
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_listar_tabelas_backup()
RETURNS TABLE(tablename text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.tablename::text
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_tabelas_backup() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_tabelas_backup() TO service_role;

NOTIFY pgrst, 'reload schema';
