-- ====================================================================================
-- MÓDULO SECRETARIA — RPC de criação de protocolo com numeração atômica.
-- fn_proximo_numero_documento não tem GRANT EXECUTE para "authenticated" de propósito
-- (create_secretaria_schema.sql) — só esta RPC (e rpc_emitir_documento) a chamam,
-- cada uma com sua própria checagem de papel. Execute depois de create_secretaria_schema.sql.
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.rpc_criar_protocolo(
  p_tipo TEXT,
  p_assunto TEXT,
  p_interessado TEXT,
  p_pessoa_id UUID,
  p_prazo DATE,
  p_observacoes TEXT
)
RETURNS protocolos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano    INTEGER := extract(year FROM current_date)::int;
  v_numero INTEGER;
  v_row    protocolos;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para registrar protocolos.' USING ERRCODE = '42501';
  END IF;

  v_numero := public.fn_proximo_numero_documento('PROTOCOLO', v_ano);

  INSERT INTO protocolos (numero, ano, tipo, assunto, interessado, pessoa_id, recebido_por, prazo, observacoes)
  VALUES (v_numero, v_ano, p_tipo, p_assunto, p_interessado, p_pessoa_id, auth.uid(), p_prazo, p_observacoes)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_protocolo(TEXT, TEXT, TEXT, UUID, DATE, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_criar_protocolo(TEXT, TEXT, TEXT, UUID, DATE, TEXT) TO authenticated;
