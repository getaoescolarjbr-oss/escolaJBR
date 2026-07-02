-- =====================================================
-- Migration: Adicionar campos de aniversário e status
-- do servidor à tabela professores
-- =====================================================

-- 1. Data de nascimento
ALTER TABLE professores
  ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- 2. Consentimento para publicar aniversário (padrão: true)
ALTER TABLE professores
  ADD COLUMN IF NOT EXISTS publicar_aniversario BOOLEAN NOT NULL DEFAULT true;

-- 3. Status funcional do servidor
ALTER TABLE professores
  ADD COLUMN IF NOT EXISTS status_servidor TEXT DEFAULT 'Efetivo(a)';

-- =====================================================
-- Tabela de log para controlar envio das notificações
-- de aniversário (evitar duplicatas no mesmo período)
-- =====================================================

CREATE TABLE IF NOT EXISTS birthday_notifications_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  professor_id UUID       NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  period      TEXT        NOT NULL CHECK (period IN ('morning', 'afternoon')),
  -- Garante no máximo 1 envio por servidor por período por dia
  UNIQUE (professor_id, period, (sent_at::date))
);

-- RLS: apenas service_role pode ler/inserir
ALTER TABLE birthday_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON birthday_notifications_log
  USING (true)
  WITH CHECK (true);
