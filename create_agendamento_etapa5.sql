-- ====================================================================================
-- MÓDULO AGENDAMENTO — Etapa 5: aprovação (RPC) + tempo real (Realtime).
-- Execute no Painel do Supabase > SQL Editor, depois de create_agendamento_schema.sql.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. rpc_decidir_reserva — aprova/recusa uma reserva PENDENTE. Só COORDENACAO/GESTAO
--    (a RLS de UPDATE já permitiria a transição, mas a RPC garante aprovado_por/
--    aprovado_em corretos e que só reservas ainda PENDENTE são afetadas).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_decidir_reserva(p_reserva_id UUID, p_aprovar BOOLEAN)
RETURNS reservas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservas;
BEGIN
  IF NOT (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Apenas Coordenação/Gestão podem aprovar ou recusar reservas.' USING ERRCODE = '42501';
  END IF;

  UPDATE reservas
  SET status = CASE WHEN p_aprovar THEN 'CONFIRMADA' ELSE 'RECUSADA' END,
      aprovado_por = auth.uid(),
      aprovado_em = now()
  WHERE id = p_reserva_id AND status = 'PENDENTE'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Reserva não encontrada ou não está mais pendente.';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_decidir_reserva(UUID, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_decidir_reserva(UUID, BOOLEAN) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 2. Tempo real — publica `reservas` no Realtime (a RLS de SELECT já existente
--    continua se aplicando: cada cliente só recebe eventos das linhas que já
--    poderia ler pela API REST normal).
-- ------------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE reservas;

-- ------------------------------------------------------------------------------------
-- 3. Log de lembretes — usado pela Edge Function agendada (supabase/functions/
--    lembrete-reservas), no mesmo padrão de birthday_notifications_log: evita mandar
--    o mesmo lembrete duas vezes. Só a service_role (Edge Function) mexe aqui.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reserva_lembretes_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id  UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  enviado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reserva_id)
);

ALTER TABLE reserva_lembretes_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reserva_lembretes_log_service_role" ON reserva_lembretes_log;
CREATE POLICY "reserva_lembretes_log_service_role" ON reserva_lembretes_log
  USING (true)
  WITH CHECK (true);
