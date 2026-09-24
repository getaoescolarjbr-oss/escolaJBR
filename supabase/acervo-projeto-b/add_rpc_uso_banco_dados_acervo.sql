-- Medidor de uso do projeto do acervo (jbr-acervo-questoes), lido pelo Portal do Administrador
-- via acervo-proxy -> acervo-api. Mesmo formato de rpc_uso_banco_dados() do projeto principal.
-- Só leitura. Só o service_role executa (a checagem de GESTAO é feita no acervo-proxy).
--
-- Rodar no projeto B (jbr-acervo-questoes), não no principal. Já aplicado em 2026-09-24
-- (migração "rpc_uso_banco_dados_acervo").
-- Reverter: drop function public.rpc_uso_banco_dados();
create or replace function public.rpc_uso_banco_dados()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'total_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'public_bytes', (
      select coalesce(sum(pg_total_relation_size(c.oid)), 0)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ),
    'maiores_tabelas', (
      select coalesce(jsonb_agg(jsonb_build_object('tabela', t.relname, 'bytes', t.bytes) order by t.bytes desc), '[]'::jsonb)
      from (
        select c.relname, pg_total_relation_size(c.oid) as bytes
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 5
      ) t
    )
  );
$$;

revoke all on function public.rpc_uso_banco_dados() from public, anon, authenticated;
grant execute on function public.rpc_uso_banco_dados() to service_role;
