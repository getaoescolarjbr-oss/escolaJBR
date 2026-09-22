-- ====================================================================================
-- Agenda o backup diário do banco pro Google Drive (Edge Function backup-to-drive).
-- pg_cron e pg_net já estão habilitados neste projeto (confirmado).
--
-- Horário: 07:00 UTC = 03:00 em Campo Grande/MS (UTC-4), igual ao padrão já usado
-- pelas outras Edge Functions agendadas deste projeto (ver setup_cron_edge_functions.sql).
--
-- O header x-backup-secret precisa bater com o Secret BACKUP_SECRET configurado na
-- Edge Function (Project Settings → Edge Functions → Secrets). Sem isso (e sem as
-- credenciais do Google também configuradas como Secret), a função responde 401/erro
-- — não trava nada, só não consegue mandar o backup até a configuração ser concluída.
-- ====================================================================================

select cron.schedule(
  'backup-diario-drive',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://hqonnxnwozfwkpqgabpf.supabase.co/functions/v1/backup-to-drive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-secret', '0Wn6LXNZDo0du09IjkHHRkjiBBAwfvgPrHprEh6_ypE'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Conferir depois:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'backup-diario-drive';
-- select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'backup-diario-drive') order by start_time desc limit 5;
