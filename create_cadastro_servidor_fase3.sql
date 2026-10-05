-- Cadastro de servidor — Fase 3: "pedir correção" (devolver o cadastro ao servidor).
--
-- A Secretaria/Gestão devolve um cadastro em análise com o motivo; ele volta a RASCUNHO, o servidor
-- corrige e envia de novo. O motivo fica em correcao_motivo (o front só o mostra enquanto o cadastro
-- não foi reenviado: enviado_em < correcao_em).
-- O termo combinado e a assinatura digital não mexem no banco: usam documentos_pessoa
-- (tipo TERMO_CONVOCACAO_ASSINADO, hash SHA-256 nas observações).
-- Aditivo: não altera o que já existe.

ALTER TABLE cadastros_servidores_pendentes
  ADD COLUMN IF NOT EXISTS correcao_motivo TEXT,
  ADD COLUMN IF NOT EXISTS correcao_em TIMESTAMPTZ;

-- O servidor não escreve na correção (só a RPC abaixo, que roda como dono da função).
CREATE OR REPLACE FUNCTION public.fn_cad_serv_proteger_convocacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $f$
DECLARE k TEXT;
BEGIN
  NEW.convocacao := public.fn_convocacao_limpar(NEW.convocacao);
  IF current_user NOT IN ('authenticated', 'anon')
     OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('SECRETARIA_GERAL') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.convite_id := NULL; NEW.convocacao := '{}'::jsonb; NEW.convocacao_modos := '{}'::jsonb;
    NEW.correcao_motivo := NULL; NEW.correcao_em := NULL;
    RETURN NEW;
  END IF;
  NEW.convite_id := OLD.convite_id;
  NEW.convocacao_modos := OLD.convocacao_modos;
  NEW.correcao_motivo := OLD.correcao_motivo;
  NEW.correcao_em := OLD.correcao_em;
  FOR k IN SELECT jsonb_object_keys(coalesce(OLD.convocacao, '{}'::jsonb) || NEW.convocacao) LOOP
    IF coalesce(OLD.convocacao_modos ->> k, 'SECRETARIA') = 'SECRETARIA' THEN
      IF OLD.convocacao ? k THEN NEW.convocacao := jsonb_set(NEW.convocacao, ARRAY[k], OLD.convocacao -> k);
      ELSE NEW.convocacao := NEW.convocacao - k;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$f$;

CREATE OR REPLACE FUNCTION public.rpc_devolver_cadastro_servidor(p_cadastro_id UUID, p_motivo TEXT)
RETURNS cadastros_servidores_pendentes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_cad cadastros_servidores_pendentes;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para devolver cadastros.' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 3 THEN RAISE EXCEPTION 'Diga ao servidor o que precisa ser corrigido.'; END IF;
  UPDATE cadastros_servidores_pendentes
     SET status = 'RASCUNHO', correcao_motivo = left(btrim(p_motivo), 500), correcao_em = now()
   WHERE id = p_cadastro_id AND status = 'PENDENTE' RETURNING * INTO v_cad;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado ou não está em análise.'; END IF;
  RETURN v_cad;
END;
$f$;
REVOKE ALL ON FUNCTION public.rpc_devolver_cadastro_servidor(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_devolver_cadastro_servidor(UUID, TEXT) TO authenticated;
