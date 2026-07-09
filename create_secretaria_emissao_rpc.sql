-- ====================================================================================
-- MÓDULO SECRETARIA — RPC de emissão de documentos.
-- Reserva o número atomicamente (fn_proximo_numero_documento), grava o snapshot e
-- registra o evento EXPORT em auditoria — tudo em uma única transação de servidor.
-- Execute depois de create_secretaria_schema.sql.
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.rpc_emitir_documento(
  p_tipo TEXT,
  p_pessoa_id UUID,
  p_matricula_id UUID,
  p_dados_snapshot JSONB
)
RETURNS documentos_emitidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano     INTEGER := extract(year FROM current_date)::int;
  v_numero  INTEGER;
  v_row     documentos_emitidos;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para emitir documentos.' USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('DECLARACAO_MATRICULA', 'HISTORICO_ESCOLAR', 'ATESTADO_FREQUENCIA', 'TRANSFERENCIA') THEN
    RAISE EXCEPTION 'Tipo de documento inválido: %', p_tipo;
  END IF;

  -- Histórico Escolar fica bloqueado por enquanto: não há dados de mais de um ano
  -- letivo nas tabelas de notas/frequência para consolidar (confirmado em 2026-07-05
  -- — banco só tem o ano corrente). Reativar quando essa base existir.
  IF p_tipo = 'HISTORICO_ESCOLAR' THEN
    RAISE EXCEPTION 'Histórico Escolar ainda não disponível — não há dados de anos letivos anteriores no banco para consolidar.';
  END IF;

  v_numero := public.fn_proximo_numero_documento(p_tipo, v_ano);

  INSERT INTO documentos_emitidos (tipo, numero, ano, pessoa_id, matricula_id, emitido_por, dados_snapshot)
  VALUES (p_tipo, v_numero, v_ano, p_pessoa_id, p_matricula_id, auth.uid(), p_dados_snapshot)
  RETURNING * INTO v_row;

  -- Emitir um documento com dados consolidados da pessoa é, em si, uma exportação de
  -- dado pessoal — registrado explicitamente como EXPORT (além do CREATE automático
  -- que o trigger genérico já grava para a própria linha de documentos_emitidos).
  INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, pessoa_afetada_id, campos_alterados)
  VALUES (auth.uid(), 'EXPORT', 'documentos_emitidos', v_row.id, p_pessoa_id, ARRAY['emissao_documento']);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_emitir_documento(TEXT, UUID, UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_emitir_documento(TEXT, UUID, UUID, JSONB) TO authenticated;
