-- =====================================================
-- Agendamento (pg_cron) das Edge Functions "de fundo"
-- =====================================================
-- Nenhuma das 3 funções abaixo tinha cron configurado — o pg_cron nem estava
-- habilitado no projeto (confirmado via `select * from cron.job;` -> erro
-- "relation cron.job does not exist"). Rode este arquivo INTEIRO no SQL Editor
-- do Supabase Studio DEPOIS de publicar as 3 funções via CLI:
--   supabase functions deploy birthday-notifications
--   supabase functions deploy lembrete-reservas
--   supabase functions deploy expire-atestados
--
-- A chave usada abaixo é a ANON KEY (não é secreta — já vai embutida em todo
-- client do navegador via VITE_SUPABASE_ANON_KEY). As Edge Functions aceitam
-- ela normalmente para autenticar a chamada; quem faz a chamada com privilégio
-- de admin de verdade é o SERVICE_ROLE_KEY, que cada função já lê sozinha via
-- Deno.env dentro do próprio Supabase — não precisa passar por aqui.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ── birthday-notifications ──────────────────────────────────────────────
-- 11:00 UTC = 07:00 Campo Grande
select cron.schedule(
  'birthday-notifications-morning',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://hqonnxnwozfwkpqgabpf.supabase.co/functions/v1/birthday-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 17:00 UTC = 13:00 Campo Grande
select cron.schedule(
  'birthday-notifications-afternoon',
  '0 17 * * *',
  $$
  select net.http_post(
    url := 'https://hqonnxnwozfwkpqgabpf.supabase.co/functions/v1/birthday-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── lembrete-reservas ────────────────────────────────────────────────────
-- A cada 10 min (a própria função filtra reservas que começam em ~30 min)
select cron.schedule(
  'lembrete-reservas',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://hqonnxnwozfwkpqgabpf.supabase.co/functions/v1/lembrete-reservas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── expire-atestados ─────────────────────────────────────────────────────
-- Todo dia às 03:00 UTC
select cron.schedule(
  'expire-atestados',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://hqonnxnwozfwkpqgabpf.supabase.co/functions/v1/expire-atestados',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhxb25ueG53b3pmd2twcWdhYnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzYwODgsImV4cCI6MjA5MzY1MjA4OH0.GZjxRoJvc7k1EeRiZ8n6JX6T-tWD7Jy7q_bKHqYwdqU'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Conferir depois:
-- select jobid, jobname, schedule, active from cron.job;
