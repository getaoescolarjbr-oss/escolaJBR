-- Chave do Gemini da função redacao-ia, lida do Vault (mesmo padrão de acervo_segredo).
-- O valor é gravado fora do SQL por scratch/gravar-chave-gemini-vault.mjs e nunca passa por aqui.
-- Aplicada em 2026-10-03 (migração redacao_ia_chave_vault).
create or replace function public.redacao_ia_chave()
 returns text
 language sql
 stable security definer
 set search_path to 'public', 'vault'
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'gemini_api_key' limit 1;
$$;

revoke all on function public.redacao_ia_chave() from public, anon, authenticated;
grant execute on function public.redacao_ia_chave() to service_role;
