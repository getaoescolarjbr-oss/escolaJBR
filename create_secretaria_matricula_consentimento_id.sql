-- ====================================================================================
-- SECRETARIA — Fechamento do gap encontrado na auditoria: matriculas.consentimento_id.
-- O trigger de exigência de consentimento (create_secretaria_schema.sql) só verificava
-- EXISTÊNCIA de um consentimento CADASTRO aceito; agora também grava QUAL consentimento
-- satisfez a exigência, sem depender do cliente informar (o cliente não pode forjar
-- um consentimento_id errado — quem resolve é o próprio trigger, no servidor).
-- ====================================================================================

ALTER TABLE matriculas ADD COLUMN IF NOT EXISTS consentimento_id UUID REFERENCES consentimentos(id);

CREATE OR REPLACE FUNCTION public.fn_matricula_exige_consentimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consentimento_id UUID;
BEGIN
  SELECT id INTO v_consentimento_id
  FROM consentimentos
  WHERE pessoa_id = NEW.pessoa_id AND tipo = 'CADASTRO' AND aceito = true
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_consentimento_id IS NULL THEN
    RAISE EXCEPTION 'Matrícula requer um consentimento de CADASTRO aceito registrado para esta pessoa antes de prosseguir.'
      USING ERRCODE = '23514';
  END IF;

  NEW.consentimento_id := v_consentimento_id;
  RETURN NEW;
END;
$$;
