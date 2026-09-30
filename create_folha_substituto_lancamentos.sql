-- ====================================================================================
-- CONTROLE DE LANÇAMENTO DE FOLHA — PROFESSOR SUBSTITUTO
--
-- Versão digital da planilha de papel da secretaria: cada linha é uma substituição a ser
-- lançada na folha (data ou período, substituto, titular, motivo, carga horária, forma de
-- pagamento SED/particular) mais a situação do lançamento (termo ok, justificativa ok,
-- lançado/pago). Cadastro e controle interno, também para impressão.
-- Fica no RH, só GESTAO e SECRETARIA. Aditivo: não altera colunas de tabelas existentes.
--
-- Origem dos dados (integrada ao que já existe no RH): quando um atestado/afastamento é
-- lançado com professor substituto (atestados_servidores.substituto_id) OU uma substituição
-- é registrada com substituto (substituicoes.substituto_id), um gatilho cria sozinho o
-- lançamento aqui, sem duplicar quando os dois cobrem o mesmo dia. A secretaria só completa
-- carga horária e se o pagamento é pela SED ou particular. Os gatilhos nunca mexem nos campos
-- preenchidos à mão nem em lançamento já marcado como lançado, e só agem na criação ou quando
-- o substituto muda — um lançamento excluído à mão não reaparece sozinho.
-- Substituto/titular guardam o id (quando está em `professores`) E o nome digitado.
-- Reversão no fim do arquivo.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS folha_substituto_lancamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia      DATE NOT NULL CHECK (EXTRACT(DAY FROM competencia) = 1), -- 1º dia do mês da folha
  data             DATE NOT NULL,                          -- dia da substituição (ou 1º dia do período)
  data_fim         DATE,                                   -- último dia do período; NULL = um dia só
  substituto_id    UUID REFERENCES professores(id) ON DELETE SET NULL,
  substituto_nome  TEXT NOT NULL CHECK (length(trim(substituto_nome)) > 0),
  titular_id       UUID REFERENCES professores(id) ON DELETE SET NULL,
  titular_nome     TEXT NOT NULL CHECK (length(trim(titular_nome)) > 0),
  motivo           TEXT NOT NULL CHECK (length(trim(motivo)) > 0),
  periodo          TEXT,                                   -- complemento livre: "manhã", "vespertino - 3h"
  turma_ids        UUID[] NOT NULL DEFAULT '{}',          -- turmas substituídas (por padrão, as do titular no dia/período)
  carga_horaria    NUMERIC(6,2) CHECK (carga_horaria IS NULL OR carga_horaria >= 0), -- em horas
  pagamento        TEXT CHECK (pagamento IN ('SED', 'PARTICULAR')),  -- NULL = a definir
  termo_ok         BOOLEAN NOT NULL DEFAULT false,
  justificativa_ok BOOLEAN NOT NULL DEFAULT false,
  lancado_folha    BOOLEAN NOT NULL DEFAULT false,
  lancado_em       TIMESTAMPTZ,
  observacoes      TEXT,
  origem           TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origem IN ('MANUAL', 'ATESTADO', 'SUBSTITUICAO')),
  atestado_id      UUID UNIQUE REFERENCES atestados_servidores(id) ON DELETE SET NULL,
  substituicao_id  UUID REFERENCES substituicoes(id) ON DELETE SET NULL,  -- 1ª substituição do RH que originou a linha
  registrado_por   UUID REFERENCES usuarios(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT folha_subst_periodo_valido CHECK (data_fim IS NULL OR data_fim >= data)
);

CREATE INDEX IF NOT EXISTS idx_folha_subst_competencia ON folha_substituto_lancamentos (competencia, data);
CREATE INDEX IF NOT EXISTS idx_folha_subst_substituto ON folha_substituto_lancamentos (substituto_id);

ALTER TABLE folha_substituto_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE folha_substituto_lancamentos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "folha_subst_gestao_secretaria" ON folha_substituto_lancamentos;
CREATE POLICY "folha_subst_gestao_secretaria" ON folha_substituto_lancamentos FOR ALL TO authenticated
  USING ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')))
  WITH CHECK ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')));

CREATE OR REPLACE FUNCTION public.fn_folha_subst_atualizar()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  -- Marcar como lançado registra o momento; desmarcar limpa.
  IF NEW.lancado_folha AND (TG_OP = 'INSERT' OR NOT OLD.lancado_folha) THEN NEW.lancado_em := now();
  ELSIF NOT NEW.lancado_folha THEN NEW.lancado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_folha_subst_atualizar ON folha_substituto_lancamentos;
CREATE TRIGGER trg_folha_subst_atualizar BEFORE INSERT OR UPDATE ON folha_substituto_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_folha_subst_atualizar();

DROP TRIGGER IF EXISTS trg_auditoria_folha_substituto ON folha_substituto_lancamentos;
CREATE TRIGGER trg_auditoria_folha_substituto AFTER INSERT OR UPDATE OR DELETE ON folha_substituto_lancamentos
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

-- ------------------------------------------------------------------------------------
-- Turmas do titular no dia/período: as que têm aula na grade (horarios) nos dias da semana
-- cobertos; se o professor não tem grade cadastrada, todas as turmas das alocações.
-- (dia_semana em horarios: 1 = segunda ... 5 = sexta, igual a EXTRACT(DOW).)
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_folha_turmas_periodo(p_titular UUID, p_ini DATE, p_fim DATE)
RETURNS UUID[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_turmas UUID[];
BEGIN
  IF p_titular IS NULL THEN RETURN '{}'; END IF;
  IF EXISTS (SELECT 1 FROM horarios WHERE professor_id = p_titular) THEN
    SELECT coalesce(array_agg(DISTINCT h.turma_id), '{}') INTO v_turmas FROM horarios h
     WHERE h.professor_id = p_titular AND h.turma_id IS NOT NULL
       AND h.dia_semana IN (SELECT EXTRACT(DOW FROM d)::int FROM generate_series(p_ini, coalesce(p_fim, p_ini), INTERVAL '1 day') d);
  ELSE
    SELECT coalesce(array_agg(DISTINCT a.turma_id), '{}') INTO v_turmas FROM alocacoes_v2 a
     WHERE a.professor_id = p_titular AND NOT a.is_espelho AND a.turma_id IS NOT NULL;
  END IF;
  RETURN v_turmas;
END;
$$;

-- ------------------------------------------------------------------------------------
-- Integração com atestados: cria/atualiza o lançamento quando o atestado tem substituto.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_folha_motivo_atestado(p_tipo TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_tipo WHEN 'ATESTADO' THEN 'Atestado' WHEN 'LICENCA' THEN 'Licença' WHEN 'FERIAS' THEN 'Férias'
                     WHEN 'FALTA' THEN 'Falta' ELSE 'Outro' END;
$$;

CREATE OR REPLACE FUNCTION public.fn_folha_criar_de_atestado(a atestados_servidores, p_competencia DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub TEXT; v_tit TEXT;
BEGIN
  SELECT nome INTO v_sub FROM professores WHERE id = a.substituto_id;
  SELECT nome INTO v_tit FROM professores WHERE id = a.professor_id;
  INSERT INTO folha_substituto_lancamentos
    (competencia, data, data_fim, turma_ids, substituto_id, substituto_nome, titular_id, titular_nome, motivo, origem, atestado_id, registrado_por)
  VALUES
    (p_competencia, a.data_inicio, CASE WHEN a.data_fim > a.data_inicio THEN a.data_fim ELSE NULL END,
     public.fn_folha_turmas_periodo(a.professor_id, a.data_inicio, a.data_fim),
     a.substituto_id, coalesce(v_sub, 'Substituto'), a.professor_id, coalesce(v_tit, 'Titular'),
     public.fn_folha_motivo_atestado(a.tipo), 'ATESTADO', a.id, (SELECT id FROM usuarios WHERE id = auth.uid()))
  ON CONFLICT (atestado_id) DO NOTHING;
  -- O atestado cobre o período inteiro: remove lançamentos soltos vindos de substituições do
  -- mesmo par (substituto/titular) dentro dele que ainda não foram para a folha.
  DELETE FROM folha_substituto_lancamentos
   WHERE origem = 'SUBSTITUICAO' AND NOT lancado_folha
     AND substituto_id = a.substituto_id AND titular_id = a.professor_id
     AND data BETWEEN a.data_inicio AND a.data_fim;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_folha_sync_atestado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub TEXT; v_tit TEXT;
BEGIN
  -- Uma falha aqui nunca pode impedir o lançamento do atestado em si.
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM folha_substituto_lancamentos WHERE atestado_id = OLD.id AND NOT lancado_folha;
      RETURN OLD;
    END IF;

    IF NEW.substituto_id IS NULL THEN
      -- Substituto retirado: some o lançamento que ainda não foi para a folha.
      DELETE FROM folha_substituto_lancamentos WHERE atestado_id = NEW.id AND NOT lancado_folha;
      RETURN NEW;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM folha_substituto_lancamentos WHERE atestado_id = NEW.id) THEN
      -- Só cria na inclusão ou quando o substituto muda: se a secretaria excluiu o lançamento
      -- à mão, uma edição qualquer do atestado não o traz de volta.
      IF TG_OP = 'INSERT' OR NEW.substituto_id IS DISTINCT FROM OLD.substituto_id THEN
        PERFORM public.fn_folha_criar_de_atestado(NEW, date_trunc('month', NEW.data_inicio)::date);
      END IF;
      RETURN NEW;
    END IF;

    -- Já existe: atualiza só o que vem do atestado, e só se ainda não foi lançado na folha.
    -- Datas só mudam se mudaram no atestado (não desfaz ajuste feito à mão na secretaria).
    SELECT nome INTO v_sub FROM professores WHERE id = NEW.substituto_id;
    SELECT nome INTO v_tit FROM professores WHERE id = NEW.professor_id;
    UPDATE folha_substituto_lancamentos SET
      substituto_id = NEW.substituto_id, substituto_nome = coalesce(v_sub, substituto_nome),
      titular_id = NEW.professor_id, titular_nome = coalesce(v_tit, titular_nome),
      motivo = public.fn_folha_motivo_atestado(NEW.tipo),
      data = CASE WHEN NEW.data_inicio IS DISTINCT FROM OLD.data_inicio THEN NEW.data_inicio ELSE data END,
      competencia = CASE WHEN NEW.data_inicio IS DISTINCT FROM OLD.data_inicio THEN date_trunc('month', NEW.data_inicio)::date ELSE competencia END,
      data_fim = CASE WHEN NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR NEW.data_fim IS DISTINCT FROM OLD.data_fim
                      THEN CASE WHEN NEW.data_fim > NEW.data_inicio THEN NEW.data_fim ELSE NULL END
                      ELSE data_fim END,
      turma_ids = CASE WHEN NEW.data_inicio IS DISTINCT FROM OLD.data_inicio OR NEW.data_fim IS DISTINCT FROM OLD.data_fim
                       THEN public.fn_folha_turmas_periodo(NEW.professor_id, NEW.data_inicio, NEW.data_fim) ELSE turma_ids END
    WHERE atestado_id = NEW.id AND NOT lancado_folha;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_folha_sync_atestado: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_folha_sync_atestado ON atestados_servidores;
CREATE TRIGGER trg_folha_sync_atestado
  AFTER INSERT OR UPDATE OF substituto_id, professor_id, data_inicio, data_fim, tipo ON atestados_servidores
  FOR EACH ROW EXECUTE FUNCTION public.fn_folha_sync_atestado();
-- A exclusão roda ANTES: depois dela a chave estrangeira (ON DELETE SET NULL) já teria zerado
-- atestado_id e o gatilho não acharia mais a linha para remover.
DROP TRIGGER IF EXISTS trg_folha_sync_atestado_del ON atestados_servidores;
CREATE TRIGGER trg_folha_sync_atestado_del
  BEFORE DELETE ON atestados_servidores
  FOR EACH ROW EXECUTE FUNCTION public.fn_folha_sync_atestado();

-- ------------------------------------------------------------------------------------
-- Integração com a Substituição do RH (substituicoes): cada substituição com substituto
-- gera UM lançamento por dia/par (várias aulas no mesmo dia não duplicam a linha).
-- FORMALIZADA_SED já entra com pagamento SED; ARRANJO_INTERNO fica "a definir".
-- Se um atestado do mesmo par já cobre o dia, não cria nada.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_folha_criar_de_substituicao(s substituicoes)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub TEXT; v_tit TEXT; v_tipo TEXT;
BEGIN
  IF s.substituto_id IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM folha_substituto_lancamentos f
     WHERE f.substituto_id = s.substituto_id AND f.titular_id = s.servidor_ausente_id
       AND s.data BETWEEN f.data AND coalesce(f.data_fim, f.data)
  ) THEN
    -- Mesmo dia/par já tem linha (outra aula): só soma a turma desta substituição a ela.
    IF s.turma_id IS NOT NULL THEN
      UPDATE folha_substituto_lancamentos f SET turma_ids = array_append(f.turma_ids, s.turma_id)
       WHERE f.origem = 'SUBSTITUICAO' AND NOT f.lancado_folha AND f.data = s.data
         AND f.substituto_id = s.substituto_id AND f.titular_id = s.servidor_ausente_id
         AND NOT (s.turma_id = ANY (f.turma_ids));
    END IF;
    RETURN;
  END IF;

  SELECT nome INTO v_sub FROM professores WHERE id = s.substituto_id;
  SELECT nome INTO v_tit FROM professores WHERE id = s.servidor_ausente_id;
  -- O motivo vem do atestado/afastamento do titular que cobre o dia, se houver.
  SELECT t.tipo INTO v_tipo FROM atestados_servidores t
   WHERE t.professor_id = s.servidor_ausente_id AND s.data BETWEEN t.data_inicio AND t.data_fim
   ORDER BY t.data_inicio DESC LIMIT 1;

  INSERT INTO folha_substituto_lancamentos
    (competencia, data, turma_ids, substituto_id, substituto_nome, titular_id, titular_nome, motivo, periodo, pagamento, origem, substituicao_id, registrado_por)
  VALUES
    (date_trunc('month', s.data)::date, s.data,
     CASE WHEN s.turma_id IS NOT NULL THEN ARRAY[s.turma_id] ELSE public.fn_folha_turmas_periodo(s.servidor_ausente_id, s.data, s.data) END,
     s.substituto_id, coalesce(v_sub, 'Substituto'), s.servidor_ausente_id, coalesce(v_tit, 'Titular'),
     CASE WHEN v_tipo IS NULL THEN 'Substituição' ELSE public.fn_folha_motivo_atestado(v_tipo) END,
     s.aula_ref, CASE WHEN s.status = 'FORMALIZADA_SED' THEN 'SED' ELSE NULL END, 'SUBSTITUICAO', s.id,
     (SELECT id FROM usuarios WHERE id = auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_folha_remover_de_substituicao(p_id UUID, p_substituto UUID, p_titular UUID, p_data DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_outra UUID;
BEGIN
  -- Se outra substituição do mesmo par/dia continua sustentando a linha, ela fica e passa a
  -- apontar para essa outra; só some quando era a última.
  SELECT x.id INTO v_outra FROM substituicoes x
   WHERE x.id <> p_id AND x.substituto_id = p_substituto AND x.servidor_ausente_id = p_titular AND x.data = p_data
   LIMIT 1;
  IF v_outra IS NOT NULL THEN
    UPDATE folha_substituto_lancamentos SET substituicao_id = v_outra WHERE substituicao_id = p_id;
    RETURN;
  END IF;
  DELETE FROM folha_substituto_lancamentos
   WHERE substituicao_id = p_id AND origem = 'SUBSTITUICAO' AND NOT lancado_folha;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_folha_sync_substituicao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Uma falha aqui nunca pode impedir o registro da substituição em si.
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.substituto_id IS NOT NULL THEN
        PERFORM public.fn_folha_remover_de_substituicao(OLD.id, OLD.substituto_id, OLD.servidor_ausente_id, OLD.data);
      END IF;
      RETURN OLD;
    END IF;

    IF NEW.substituto_id IS NULL THEN
      IF TG_OP = 'UPDATE' AND OLD.substituto_id IS NOT NULL THEN
        PERFORM public.fn_folha_remover_de_substituicao(NEW.id, OLD.substituto_id, OLD.servidor_ausente_id, OLD.data);
      END IF;
      RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' OR NEW.substituto_id IS DISTINCT FROM OLD.substituto_id THEN
      IF TG_OP = 'UPDATE' AND OLD.substituto_id IS NOT NULL THEN
        PERFORM public.fn_folha_remover_de_substituicao(NEW.id, OLD.substituto_id, OLD.servidor_ausente_id, OLD.data);
      END IF;
      PERFORM public.fn_folha_criar_de_substituicao(NEW);
    ELSIF NEW.status = 'FORMALIZADA_SED' AND OLD.status IS DISTINCT FROM NEW.status THEN
      -- Formalizada na SED: a forma de pagamento passa a SED, se ainda não foi definida.
      UPDATE folha_substituto_lancamentos SET pagamento = 'SED'
       WHERE substituicao_id = NEW.id AND pagamento IS NULL AND NOT lancado_folha;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_folha_sync_substituicao: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_folha_sync_substituicao ON substituicoes;
CREATE TRIGGER trg_folha_sync_substituicao
  AFTER INSERT OR UPDATE OF substituto_id, status ON substituicoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_folha_sync_substituicao();
DROP TRIGGER IF EXISTS trg_folha_sync_substituicao_del ON substituicoes;
CREATE TRIGGER trg_folha_sync_substituicao_del
  BEFORE DELETE ON substituicoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_folha_sync_substituicao();

-- Traz para a competência o que ainda não tem lançamento: atestados com substituto e
-- substituições do mês com substituto (os anteriores a este recurso). Devolve quantos criou.
CREATE OR REPLACE FUNCTION public.rpc_folha_importar_atestados(p_competencia DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a atestados_servidores; s substituicoes;
  v_n INTEGER := 0; v_antes INTEGER;
  v_inicio DATE := date_trunc('month', p_competencia)::date;
  v_fim DATE := (date_trunc('month', p_competencia) + INTERVAL '1 month - 1 day')::date;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  -- Atestados primeiro (cobrem o período inteiro), depois as substituições soltas.
  FOR a IN
    SELECT * FROM atestados_servidores t
     WHERE t.substituto_id IS NOT NULL AND t.data_inicio <= v_fim AND t.data_fim >= v_inicio
       AND NOT EXISTS (SELECT 1 FROM folha_substituto_lancamentos f WHERE f.atestado_id = t.id)
  LOOP
    PERFORM public.fn_folha_criar_de_atestado(a, v_inicio);
    v_n := v_n + 1;
  END LOOP;
  FOR s IN
    SELECT * FROM substituicoes x
     WHERE x.substituto_id IS NOT NULL AND x.data BETWEEN v_inicio AND v_fim
       AND NOT EXISTS (SELECT 1 FROM folha_substituto_lancamentos f WHERE f.substituicao_id = x.id)
     ORDER BY x.data
  LOOP
    SELECT count(*) INTO v_antes FROM folha_substituto_lancamentos;
    PERFORM public.fn_folha_criar_de_substituicao(s);
    v_n := v_n + (SELECT count(*) FROM folha_substituto_lancamentos) - v_antes;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_folha_importar_atestados(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_folha_importar_atestados(DATE) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_folha_turmas_periodo(UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_folha_criar_de_atestado(atestados_servidores, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_folha_sync_atestado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_folha_criar_de_substituicao(substituicoes) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_folha_remover_de_substituicao(UUID, UUID, UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_folha_sync_substituicao() FROM PUBLIC, anon, authenticated;

-- REVERSÃO (descarta os lançamentos gravados):
--   DROP TRIGGER IF EXISTS trg_folha_sync_substituicao_del ON substituicoes;
--   DROP TRIGGER IF EXISTS trg_folha_sync_atestado_del ON atestados_servidores;
--   DROP TRIGGER IF EXISTS trg_folha_sync_substituicao ON substituicoes;
--   DROP FUNCTION IF EXISTS public.fn_folha_sync_substituicao();
--   DROP FUNCTION IF EXISTS public.fn_folha_remover_de_substituicao(UUID, UUID, UUID, DATE);
--   DROP FUNCTION IF EXISTS public.fn_folha_criar_de_substituicao(substituicoes);
--   DROP TRIGGER IF EXISTS trg_folha_sync_atestado ON atestados_servidores;
--   DROP FUNCTION IF EXISTS public.rpc_folha_importar_atestados(DATE);
--   DROP FUNCTION IF EXISTS public.fn_folha_sync_atestado();
--   DROP FUNCTION IF EXISTS public.fn_folha_criar_de_atestado(atestados_servidores, DATE);
--   DROP FUNCTION IF EXISTS public.fn_folha_motivo_atestado(TEXT);
--   DROP FUNCTION IF EXISTS public.fn_folha_turmas_periodo(UUID, DATE, DATE);
--   DROP TABLE IF EXISTS folha_substituto_lancamentos;
--   DROP FUNCTION IF EXISTS public.fn_folha_subst_atualizar();
