-- A tela de editar avaliação de área fica indisponível depois de publicada (correto, pra não
-- mexer em cotas/valor/turma que já geraram nota) — mas embaralhamento/versões/cartão-resposta
-- são só configuração de IMPRESSÃO, não afetam nota nenhuma, e o coordenador precisa poder
-- ajustar isso mesmo depois de publicar (ex.: essa avaliação já publicada e o coordenador quer
-- gerar mais de uma versão pra imprimir agora). RPC separada, sem a trava de status.

CREATE OR REPLACE FUNCTION public.rpc_definir_impressao_avaliacao_area(
  p_prova_id UUID,
  p_embaralhar TEXT,
  p_qtd_versoes SMALLINT,
  p_cartao_separado BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_criado_por UUID;
BEGIN
  SELECT criado_por INTO v_criado_por FROM public.provas WHERE id = p_prova_id AND eh_prova_area = true;
  IF v_criado_por IS NULL THEN
    RAISE EXCEPTION 'Avaliação de área não encontrada.';
  END IF;
  IF NOT (
    v_criado_por = auth.uid()
    OR public.usuario_tem_papel('COORDENACAO_AREA')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para configurar a impressão desta avaliação de área.';
  END IF;

  UPDATE public.provas SET
    embaralhar = COALESCE(p_embaralhar, 'NENHUM'),
    qtd_versoes = GREATEST(COALESCE(p_qtd_versoes, 1), 1),
    cartao_separado = COALESCE(p_cartao_separado, false),
    updated_at = now()
  WHERE id = p_prova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_definir_impressao_avaliacao_area(UUID, TEXT, SMALLINT, BOOLEAN) TO authenticated;

-- Força o PostgREST a recarregar o schema na hora — sem isso, às vezes o cache dele demora
-- (ou não atualiza sozinho) e o front continua recebendo "Could not find the function" mesmo
-- com a função já criada com sucesso no banco.
NOTIFY pgrst, 'reload schema';
