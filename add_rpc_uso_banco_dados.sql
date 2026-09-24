-- Medidor de uso do banco para o Portal do Administrador.
--
-- Devolve o tamanho total do banco (o que a cota do plano gratuito do Supabase conta),
-- quanto é do schema public, e as 5 maiores tabelas — para saber o que está ocupando espaço.
-- Só a GESTAO pode chamar (a checagem é dentro da função, que é SECURITY DEFINER para
-- conseguir ler o tamanho de tabelas que o usuário comum não enxerga).
--
-- Reverter: drop function public.rpc_uso_banco_dados();

create or replace function public.rpc_uso_banco_dados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (select public.usuario_tem_papel('GESTAO')) then
    raise exception 'Acesso restrito à gestão' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total_bytes', pg_database_size(current_database()),
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
end;
$$;

revoke all on function public.rpc_uso_banco_dados() from public, anon;
grant execute on function public.rpc_uso_banco_dados() to authenticated;
