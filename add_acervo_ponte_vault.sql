-- Segredo compartilhado entre a Edge Function acervo-proxy (projeto principal) e a acervo-api
-- (projeto jbr-acervo-questoes). Rodar UMA vez em CADA projeto, com o MESMO valor.
-- O valor real NÃO fica no repositório: foi gerado por node (32 bytes aleatórios) e guardado só no
-- Vault dos dois projetos. Para trocar (rotacionar): vault.update_secret no dois projetos.
--
--   select vault.create_secret('<valor-aleatorio-64-hex>', 'acervo_api_secret', 'Segredo da ponte acervo-proxy -> acervo-api');

create or replace function public.acervo_segredo()
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'acervo_api_secret' limit 1;
$$;

-- Só a chave de serviço (usada pelas Edge Functions) consegue ler o segredo.
revoke all on function public.acervo_segredo() from public, anon, authenticated;
grant execute on function public.acervo_segredo() to service_role;

-- Reverter: drop function public.acervo_segredo(); e apagar o segredo do Vault.
