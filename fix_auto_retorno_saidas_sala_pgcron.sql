-- Auto-retorno de alunos nos intervalos (09:10, 11:55 e 15:40), agora no servidor.
--
-- Antes: o Dashboard de CADA professor logado rodava, a cada 60 s, até 3 UPDATEs em
-- saidas_sala — e ainda comparava a hora local (09:10) como se fosse UTC
-- (`${hoje}T09:10:00.000Z`), o que no fuso de MS (UTC-4) equivale a 05:10 local. Na
-- prática, os alunos que saíam depois das ~05:10/07:55/11:40 nunca eram marcados como
-- "Retornou". `hoje` também virava o dia seguinte depois das 20h locais (toISOString).
--
-- Agora: uma função que usa o fuso America/Campo_Grande e um job do pg_cron a cada
-- 2 minutos em horário escolar (11-21 UTC = 07-17 local, seg-sex). O job é idempotente:
-- só mexe em quem ainda está "Fora". Roda também em UTC fixo, mas quem decide o horário
-- de intervalo é a função (fuso IANA), então não quebra se o horário de verão voltar.
--
-- Reverter:  select cron.unschedule('auto-retorno-saidas-sala');
--            drop function public.auto_retorno_saidas_sala();

create or replace function public.auto_retorno_saidas_sala()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz      constant text := 'America/Campo_Grande';
  v_agora   timestamp := now() at time zone v_tz;         -- relógio local (sem fuso)
  v_dia     date := (now() at time zone v_tz)::date;
  v_inicio  timestamptz := v_dia::timestamp at time zone v_tz;
  v_hora    time;
  v_limite  timestamptz;
  v_n       integer;
  v_total   integer := 0;
begin
  -- Em ordem crescente: quem saiu antes das 09:10 volta às 09:10; quem saiu entre 09:10 e
  -- 11:55 volta às 11:55; e assim por diante.
  foreach v_hora in array array['09:10', '11:55', '15:40']::time[] loop
    if v_agora::time >= v_hora then
      v_limite := (v_dia + v_hora) at time zone v_tz;
      update public.saidas_sala
         set status = 'Retornou',
             hora_retorno = v_limite
       where status = 'Fora'
         and hora_saida >= v_inicio
         and hora_saida <  v_limite;
      get diagnostics v_n = row_count;
      v_total := v_total + v_n;
    end if;
  end loop;
  return v_total;
end;
$$;

-- Só o pg_cron (dono) executa; nenhum cliente do navegador precisa chamar isto.
revoke all on function public.auto_retorno_saidas_sala() from public, anon, authenticated;

select cron.schedule(
  'auto-retorno-saidas-sala',
  '*/2 11-21 * * 1-5',
  $job$select public.auto_retorno_saidas_sala();$job$
);
