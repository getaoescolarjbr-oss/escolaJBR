-- Cadastro de servidor — Fase 2: link de convite + quem preenche cada campo da convocação.
--
--  * convocacao_campos: campos do termo de convocado que podem ser preenchidos no cadastro e,
--    para cada um, o modo padrão: SECRETARIA (só a Secretaria), PROFESSOR (só o servidor) ou AMBOS.
--  * convites_cadastro_servidor: link que a Secretaria gera (e-mail/nome opcionais, valores e modos
--    por campo). Validade de 14 dias, uso único, pode ser revogado.
--  * cadastros_servidores_pendentes ganha convite_id, convocacao (valores) e convocacao_modos
--    (modo de cada campo, congelado na criação do cadastro).
--  * Um gatilho impede o servidor de mexer em campo cujo modo é SECRETARIA, no convite ou nos modos.
--  * A Secretaria/Gestão edita qualquer campo pela RPC rpc_salvar_convocacao_cadastro.
-- Aditivo: não altera o que já existe nem o fluxo antigo.

-- ---------------------------------------------------------------------------
-- 1. Campos da convocação
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS convocacao_campos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campo TEXT NOT NULL UNIQUE,
  rotulo TEXT NOT NULL,
  dica TEXT,
  modo TEXT NOT NULL DEFAULT 'SECRETARIA' CHECK (modo IN ('SECRETARIA', 'PROFESSOR', 'AMBOS')),
  ordem INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE convocacao_campos ENABLE ROW LEVEL SECURITY;
ALTER TABLE convocacao_campos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conv_campos_select" ON convocacao_campos;
CREATE POLICY "conv_campos_select" ON convocacao_campos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "conv_campos_update" ON convocacao_campos;
CREATE POLICY "conv_campos_update" ON convocacao_campos FOR UPDATE TO authenticated
  USING ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')) OR (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')))
  WITH CHECK ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')) OR (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')));
DROP TRIGGER IF EXISTS trg_auditoria_convocacao_campos ON convocacao_campos;
CREATE TRIGGER trg_auditoria_convocacao_campos AFTER INSERT OR UPDATE OR DELETE ON convocacao_campos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

INSERT INTO convocacao_campos (campo, rotulo, dica, modo, ordem) VALUES
  ('horas_semanais', 'Horas semanais', 'Carga horária semanal da convocação.', 'AMBOS', 10),
  ('componente', 'Componente curricular', 'Disciplina(s) que vai ministrar.', 'AMBOS', 20),
  ('escola_municipio', 'Escola / município', NULL, 'SECRETARIA', 30),
  ('periodo_de', 'Período — início', NULL, 'SECRETARIA', 40),
  ('periodo_ate', 'Período — fim', NULL, 'SECRETARIA', 50),
  ('substituido_nome', 'Servidor substituído', NULL, 'SECRETARIA', 60),
  ('substituido_matricula', 'Matrícula do substituído', NULL, 'SECRETARIA', 70),
  ('valor_hora', 'Valor da hora-aula', NULL, 'SECRETARIA', 80),
  ('fundamento_valor', 'Fundamento do valor', NULL, 'SECRETARIA', 90)
ON CONFLICT (campo) DO NOTHING;

-- Mantém só chaves conhecidas com valor texto (até 300 caracteres, sem espaços nas pontas).
CREATE OR REPLACE FUNCTION public.fn_convocacao_limpar(p JSONB)
RETURNS JSONB LANGUAGE sql STABLE SET search_path = public AS $f$
  SELECT coalesce(jsonb_object_agg(e.key, to_jsonb(left(btrim(e.value), 300))), '{}'::jsonb)
    FROM jsonb_each_text(CASE WHEN jsonb_typeof(p) = 'object' THEN p ELSE '{}'::jsonb END) e
   WHERE e.key IN (SELECT campo FROM convocacao_campos) AND btrim(e.value) <> '';
$f$;

-- ---------------------------------------------------------------------------
-- 2. Convites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS convites_cadastro_servidor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  email TEXT,
  nome TEXT,
  -- {campo: {"modo": "SECRETARIA|PROFESSOR|AMBOS", "valor": "..."}} — só o que foge do padrão/foi preenchido.
  campos JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por UUID NOT NULL DEFAULT auth.uid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  usado_em TIMESTAMPTZ,
  cadastro_id UUID,
  revogado BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_convites_cad_serv_criado ON convites_cadastro_servidor (criado_em DESC);
ALTER TABLE convites_cadastro_servidor ENABLE ROW LEVEL SECURITY;
ALTER TABLE convites_cadastro_servidor FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "convites_cs_staff" ON convites_cadastro_servidor;
CREATE POLICY "convites_cs_staff" ON convites_cadastro_servidor FOR ALL TO authenticated
  USING ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')) OR (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')))
  WITH CHECK ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')) OR (SELECT public.usuario_tem_papel('SECRETARIA_GERAL')));
DROP TRIGGER IF EXISTS trg_auditoria_convites_cs ON convites_cadastro_servidor;
CREATE TRIGGER trg_auditoria_convites_cs AFTER INSERT OR UPDATE OR DELETE ON convites_cadastro_servidor
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

-- ---------------------------------------------------------------------------
-- 3. Pedido: convite, valores e modos
-- ---------------------------------------------------------------------------
ALTER TABLE cadastros_servidores_pendentes
  ADD COLUMN IF NOT EXISTS convite_id UUID REFERENCES convites_cadastro_servidor(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS convocacao JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS convocacao_modos JSONB NOT NULL DEFAULT '{}'::jsonb;

-- O servidor só altera campo cujo modo é PROFESSOR ou AMBOS; convite e modos são intocáveis.
CREATE OR REPLACE FUNCTION public.fn_cad_serv_proteger_convocacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $f$
DECLARE k TEXT;
BEGIN
  NEW.convocacao := public.fn_convocacao_limpar(NEW.convocacao);
  -- RPCs SECURITY DEFINER (aplicar convite, enviar, aprovar) rodam como dono da função e são livres;
  -- só o acesso direto do servidor (papel authenticated) é restringido.
  IF current_user NOT IN ('authenticated', 'anon')
     OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('SECRETARIA_GERAL') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.convite_id := NULL;
    NEW.convocacao := '{}'::jsonb;
    NEW.convocacao_modos := '{}'::jsonb;
    RETURN NEW;
  END IF;
  NEW.convite_id := OLD.convite_id;
  NEW.convocacao_modos := OLD.convocacao_modos;
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
DROP TRIGGER IF EXISTS trg_cad_serv_proteger_convocacao ON cadastros_servidores_pendentes;
CREATE TRIGGER trg_cad_serv_proteger_convocacao BEFORE INSERT OR UPDATE ON cadastros_servidores_pendentes
  FOR EACH ROW EXECUTE FUNCTION fn_cad_serv_proteger_convocacao();

-- ---------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------
-- Antes do cadastro (sem login): o link vale? Devolve só o necessário para pré-preencher.
CREATE OR REPLACE FUNCTION public.rpc_consultar_convite(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $f$
DECLARE v convites_cadastro_servidor;
BEGIN
  SELECT * INTO v FROM convites_cadastro_servidor WHERE token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('valido', false, 'motivo', 'Convite não encontrado.'); END IF;
  IF v.revogado THEN RETURN jsonb_build_object('valido', false, 'motivo', 'Este convite foi cancelado pela Secretaria.'); END IF;
  IF v.usado_em IS NOT NULL THEN RETURN jsonb_build_object('valido', false, 'motivo', 'Este convite já foi utilizado.'); END IF;
  IF v.expira_em < now() THEN RETURN jsonb_build_object('valido', false, 'motivo', 'Este convite expirou. Peça um novo à Secretaria.'); END IF;
  RETURN jsonb_build_object('valido', true, 'email', v.email, 'nome', v.nome);
END;
$f$;
REVOKE ALL ON FUNCTION public.rpc_consultar_convite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_consultar_convite(TEXT) TO anon, authenticated;

-- Logo depois de criar o pedido: congela os modos de cada campo (padrão + ajustes do convite)
-- e, se houver convite válido, copia os valores e marca o convite como usado.
CREATE OR REPLACE FUNCTION public.rpc_aplicar_convite(p_cadastro_id UUID, p_token TEXT DEFAULT NULL)
RETURNS cadastros_servidores_pendentes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE
  v_cad cadastros_servidores_pendentes; v_conv convites_cadastro_servidor;
  v_modos JSONB; v_vals JSONB := '{}'::jsonb; c RECORD; v_modo TEXT; v_valor TEXT;
BEGIN
  SELECT * INTO v_cad FROM cadastros_servidores_pendentes WHERE id = p_cadastro_id AND auth_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado.'; END IF;
  IF v_cad.status <> 'RASCUNHO' THEN RAISE EXCEPTION 'Este cadastro já foi enviado.'; END IF;
  IF v_cad.convite_id IS NOT NULL OR v_cad.convocacao_modos <> '{}'::jsonb THEN RETURN v_cad; END IF;

  IF p_token IS NOT NULL THEN
    SELECT * INTO v_conv FROM convites_cadastro_servidor WHERE token = p_token FOR UPDATE;
    IF NOT FOUND OR v_conv.revogado OR v_conv.usado_em IS NOT NULL OR v_conv.expira_em < now() THEN
      RAISE EXCEPTION 'Convite inválido, usado ou expirado.'; END IF;
    IF v_conv.email IS NOT NULL AND lower(v_conv.email) <> lower(v_cad.email) THEN
      RAISE EXCEPTION 'Este convite é para outro e-mail.'; END IF;
  END IF;

  v_modos := '{}'::jsonb;
  FOR c IN SELECT campo, modo FROM convocacao_campos LOOP
    v_modo := coalesce(v_conv.campos -> c.campo ->> 'modo', c.modo);
    IF v_modo NOT IN ('SECRETARIA', 'PROFESSOR', 'AMBOS') THEN v_modo := c.modo; END IF;
    v_modos := v_modos || jsonb_build_object(c.campo, v_modo);
    v_valor := btrim(coalesce(v_conv.campos -> c.campo ->> 'valor', ''));
    IF v_valor <> '' THEN v_vals := v_vals || jsonb_build_object(c.campo, v_valor); END IF;
  END LOOP;

  UPDATE cadastros_servidores_pendentes
     SET convite_id = v_conv.id, convocacao_modos = v_modos, convocacao = v_vals
   WHERE id = v_cad.id RETURNING * INTO v_cad;
  IF v_conv.id IS NOT NULL THEN
    UPDATE convites_cadastro_servidor SET usado_em = now(), cadastro_id = v_cad.id WHERE id = v_conv.id;
  END IF;
  RETURN v_cad;
END;
$f$;
REVOKE ALL ON FUNCTION public.rpc_aplicar_convite(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_aplicar_convite(UUID, TEXT) TO authenticated;

-- Secretaria/Gestão edita qualquer campo da convocação, em rascunho ou em análise.
CREATE OR REPLACE FUNCTION public.rpc_salvar_convocacao_cadastro(p_cadastro_id UUID, p_convocacao JSONB)
RETURNS cadastros_servidores_pendentes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
DECLARE v_cad cadastros_servidores_pendentes;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('SECRETARIA_GERAL')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
  UPDATE cadastros_servidores_pendentes
     SET convocacao = public.fn_convocacao_limpar(p_convocacao)
   WHERE id = p_cadastro_id AND status IN ('RASCUNHO', 'PENDENTE') RETURNING * INTO v_cad;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado ou já analisado.'; END IF;
  RETURN v_cad;
END;
$f$;
REVOKE ALL ON FUNCTION public.rpc_salvar_convocacao_cadastro(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_salvar_convocacao_cadastro(UUID, JSONB) TO authenticated;
