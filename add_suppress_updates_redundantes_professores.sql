-- Descarta UPDATEs de `professores` que não mudam nenhum valor.
--
-- O App.tsx regravava tema/configuração do professor a cada login, renovação de token e
-- re-render: 42.135 UPDATEs em 67 linhas, e 31.008 dos 32.327 registros da `auditoria`
-- (96%) eram só isso. O front já foi corrigido (só grava quando algo mudou), mas navegadores
-- com a versão antiga em cache continuam mandando. suppress_redundant_updates_trigger() é
-- nativa do Postgres: se NEW = OLD, cancela o UPDATE — sem escrita, sem WAL, sem linha
-- morta e sem disparar o trigger de auditoria (que é AFTER).
--
-- O nome começa com "z_" de propósito: triggers BEFORE rodam em ordem alfabética e este
-- precisa ser o último, para comparar a linha já com as alterações dos demais.
--
-- Reverter: drop trigger z_suppress_updates_redundantes on public.professores;

drop trigger if exists z_suppress_updates_redundantes on public.professores;
create trigger z_suppress_updates_redundantes
  before update on public.professores
  for each row execute function suppress_redundant_updates_trigger();
