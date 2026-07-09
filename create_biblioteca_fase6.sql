-- ====================================================================================
-- BIBLIOTECA — Fase 6 (Loja de prêmios): a única peça de backend que faltava é o
-- cancelamento de resgate com estorno — marcar ENTREGUE já é uma UPDATE direta
-- permitida pela RLS de `resgates` (Fase 1), mas cancelar precisa devolver o ponto ao
-- aluno e a unidade ao estoque, e `pontos_ledger` não aceita INSERT de ninguém a não
-- ser por função SECURITY DEFINER — daí a RPC.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.rpc_cancelar_resgate(p_resgate_id UUID)
RETURNS resgates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resgate resgates;
BEGIN
  IF NOT (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar resgates.';
  END IF;

  SELECT * INTO v_resgate FROM resgates WHERE id = p_resgate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resgate não encontrado.';
  END IF;
  IF v_resgate.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'Só é possível cancelar um resgate pendente.';
  END IF;

  UPDATE recompensas SET estoque = estoque + 1 WHERE id = v_resgate.recompensa_id;

  INSERT INTO pontos_ledger (aluno_id, delta, origem, referencia_id, criado_por)
  VALUES (v_resgate.aluno_id, v_resgate.custo_pontos, 'RESGATE_LOJA', v_resgate.id, auth.uid());

  UPDATE resgates SET status = 'CANCELADO' WHERE id = p_resgate_id RETURNING * INTO v_resgate;

  RETURN v_resgate;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cancelar_resgate(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_resgate(UUID) TO authenticated;
