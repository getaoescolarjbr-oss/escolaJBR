-- ====================================================================================
-- AGENDAMENTO — Expansão (Etapa 1): modelo das novidades + RLS. Reaproveita 100% do
-- que já existe (recursos, reservas, EXCLUDE constraint, get_disponibilidade,
-- Realtime, pushService) — nada disso é recriado ou alterado na sua lógica central.
--
-- Confirmado antes de desenhar (ver apresentação anterior): a checagem de conflito
-- (reservas_sem_sobreposicao, EXCLUDE USING gist) já é atômica e continua sendo a
-- ÚNICA fonte de verdade sobre conflito — inclusive para as ocorrências geradas pela
-- recorrência (cada INSERT de ocorrência passa pela mesma constraint). O bloqueio
-- geral de horário já funciona hoje (fn_reserva_bloqueia_manutencao não filtra por
-- motivo) — nenhuma mudança de schema precisa pra isso, só tela.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. reservas_serie — a série recorrente. Sem policy de INSERT/UPDATE/DELETE: só as
--    RPCs (item 4) criam/cancelam, pra manter a geração de ocorrências e o
--    cancelamento em massa sempre atômicos e consistentes com a regra de dono.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas_serie (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id      UUID NOT NULL REFERENCES recursos(id),
  professor_id    UUID NOT NULL REFERENCES professores(id),
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio     TIME NOT NULL,
  hora_fim        TIME NOT NULL CHECK (hora_fim > hora_inicio),
  vigencia_inicio DATE NOT NULL,
  vigencia_fim    DATE NOT NULL CHECK (vigencia_fim >= vigencia_inicio),
  turma_id        UUID REFERENCES turmas(id),
  finalidade      TEXT,
  status          TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'CANCELADA')),
  criado_por      UUID NOT NULL REFERENCES usuarios(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservas_serie_recurso ON reservas_serie (recurso_id);
CREATE INDEX IF NOT EXISTS idx_reservas_serie_professor ON reservas_serie (professor_id);

ALTER TABLE reservas_serie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservas_serie_select" ON reservas_serie FOR SELECT TO authenticated
  USING (
    professor_id IN (SELECT id FROM professores WHERE user_id = auth.uid())
    OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
  );

CREATE TRIGGER trg_auditoria_reservas_serie
  AFTER INSERT OR UPDATE OR DELETE ON reservas_serie
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. reservas: novas colunas. serie_id liga cada ocorrência à série que a gerou
--    (NULL = reserva avulsa, comportamento de hoje intacto). tema/objetivos como
--    colunas de primeira classe (usados em toda reserva de professor) — campos
--    personalizados (item 3) ficam pra necessidades específicas por agenda.
-- ------------------------------------------------------------------------------------
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS serie_id UUID REFERENCES reservas_serie(id);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS tema TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS objetivos TEXT;

CREATE INDEX IF NOT EXISTS idx_reservas_serie_id ON reservas (serie_id);

-- ------------------------------------------------------------------------------------
-- 3. campos_personalizados / reserva_valores_personalizados — extensão de formulário
--    por agenda (recurso_id NULL = vale pra qualquer recurso). Leitura aberta a
--    PROFESSOR também (precisa ver o campo pra preencher no formulário de reserva).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campos_personalizados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id  UUID REFERENCES recursos(id),
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('TEXTO', 'NUMERO', 'DATA', 'BOOLEANO', 'SELECAO')),
  opcoes      TEXT[],
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campos_personalizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campos_personalizados_select" ON campos_personalizados FOR SELECT TO authenticated
  USING (ativo = true OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

CREATE POLICY "campos_personalizados_write" ON campos_personalizados FOR ALL TO authenticated
  USING (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER trg_auditoria_campos_personalizados
  AFTER INSERT OR UPDATE OR DELETE ON campos_personalizados
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TABLE IF NOT EXISTS reserva_valores_personalizados (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID NOT NULL REFERENCES reservas(id),
  campo_id   UUID NOT NULL REFERENCES campos_personalizados(id),
  valor      TEXT,
  UNIQUE (reserva_id, campo_id)
);

ALTER TABLE reserva_valores_personalizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reserva_valores_personalizados_rw" ON reserva_valores_personalizados FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM reservas r JOIN professores p ON p.id = r.professor_id WHERE r.id = reserva_valores_personalizados.reserva_id AND p.user_id = auth.uid())
    OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reservas r JOIN professores p ON p.id = r.professor_id WHERE r.id = reserva_valores_personalizados.reserva_id AND p.user_id = auth.uid())
    OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
  );

CREATE TRIGGER trg_auditoria_reserva_valores_personalizados
  AFTER INSERT OR UPDATE OR DELETE ON reserva_valores_personalizados
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 4. reserva_compartilhamentos — compartilhamento direcionado (confirmado com o
--    usuário: destinatário(s) específico(s) escolhidos, não broadcast). O aviso em
--    si é disparado pelo cliente via pushService.sendPushToUsers já existente — esta
--    tabela só é o registro de quem compartilhou com quem.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reserva_compartilhamentos (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id                  UUID NOT NULL REFERENCES reservas(id),
  compartilhado_com_usuario_id UUID NOT NULL REFERENCES usuarios(id),
  compartilhado_por          UUID NOT NULL REFERENCES usuarios(id),
  criado_em                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reserva_id, compartilhado_com_usuario_id)
);

ALTER TABLE reserva_compartilhamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reserva_compartilhamentos_select" ON reserva_compartilhamentos FOR SELECT TO authenticated
  USING (
    compartilhado_por = auth.uid() OR compartilhado_com_usuario_id = auth.uid()
    OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
  );

CREATE POLICY "reserva_compartilhamentos_insert" ON reserva_compartilhamentos FOR INSERT TO authenticated
  WITH CHECK (
    compartilhado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM reservas r JOIN professores p ON p.id = r.professor_id
      WHERE r.id = reserva_compartilhamentos.reserva_id
        AND (p.user_id = auth.uid() OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
    )
  );

CREATE POLICY "reserva_compartilhamentos_delete" ON reserva_compartilhamentos FOR DELETE TO authenticated
  USING (compartilhado_por = auth.uid() OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER trg_auditoria_reserva_compartilhamentos
  AFTER INSERT OR UPDATE OR DELETE ON reserva_compartilhamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 5. rpc_criar_serie_recorrente — gera as ocorrências dentro do período de vigência.
--    Cada INSERT de ocorrência roda numa sub-transação própria (BEGIN/EXCEPTION): um
--    conflito (a MESMA EXCLUDE constraint de sempre) numa data específica é
--    capturado e reportado na linha de retorno correspondente, sem abortar as
--    demais ocorrências da série. Respeita requer_aprovacao do recurso, igual a uma
--    reserva avulsa.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_criar_serie_recorrente(
  p_recurso_id UUID,
  p_professor_id UUID,
  p_dia_semana SMALLINT,
  p_hora_inicio TIME,
  p_hora_fim TIME,
  p_vigencia_inicio DATE,
  p_vigencia_fim DATE,
  p_turma_id UUID,
  p_finalidade TEXT
)
RETURNS TABLE (data DATE, sucesso BOOLEAN, motivo TEXT, reserva_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_serie_id UUID;
  v_requer_aprovacao BOOLEAN;
  v_status TEXT;
  v_data DATE;
  v_offset INT;
  v_reserva reservas;
BEGIN
  IF NOT (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')
    OR (public.usuario_tem_papel('PROFESSOR') AND p_professor_id IN (SELECT id FROM professores WHERE user_id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar série recorrente para este professor.' USING ERRCODE = '42501';
  END IF;

  IF p_dia_semana NOT BETWEEN 0 AND 6 THEN
    RAISE EXCEPTION 'Dia da semana inválido (use 0=domingo a 6=sábado).';
  END IF;
  IF p_hora_fim <= p_hora_inicio THEN
    RAISE EXCEPTION 'Hora fim deve ser maior que hora início.';
  END IF;
  IF p_vigencia_fim < p_vigencia_inicio THEN
    RAISE EXCEPTION 'Vigência fim deve ser maior ou igual à vigência início.';
  END IF;

  SELECT requer_aprovacao INTO v_requer_aprovacao FROM recursos WHERE id = p_recurso_id;
  IF v_requer_aprovacao IS NULL THEN
    RAISE EXCEPTION 'Recurso não encontrado.';
  END IF;
  v_status := CASE WHEN v_requer_aprovacao THEN 'PENDENTE' ELSE 'CONFIRMADA' END;

  INSERT INTO reservas_serie (recurso_id, professor_id, dia_semana, hora_inicio, hora_fim, vigencia_inicio, vigencia_fim, turma_id, finalidade, criado_por)
  VALUES (p_recurso_id, p_professor_id, p_dia_semana, p_hora_inicio, p_hora_fim, p_vigencia_inicio, p_vigencia_fim, p_turma_id, p_finalidade, auth.uid())
  RETURNING id INTO v_serie_id;

  v_offset := (p_dia_semana - EXTRACT(DOW FROM p_vigencia_inicio)::int + 7) % 7;
  v_data := p_vigencia_inicio + v_offset;

  WHILE v_data <= p_vigencia_fim LOOP
    BEGIN
      INSERT INTO reservas (recurso_id, professor_id, turma_id, finalidade, data, hora_inicio, hora_fim, status, criado_por, serie_id)
      VALUES (p_recurso_id, p_professor_id, p_turma_id, p_finalidade, v_data, p_hora_inicio, p_hora_fim, v_status, auth.uid(), v_serie_id)
      RETURNING * INTO v_reserva;

      data := v_data; sucesso := true; motivo := NULL; reserva_id := v_reserva.id;
      RETURN NEXT;
    EXCEPTION
      WHEN exclusion_violation THEN
        data := v_data; sucesso := false; motivo := 'Conflito de horário nesta data.'; reserva_id := NULL;
        RETURN NEXT;
    END;
    v_data := v_data + 7;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_serie_recorrente(UUID, UUID, SMALLINT, TIME, TIME, DATE, DATE, UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_criar_serie_recorrente(UUID, UUID, SMALLINT, TIME, TIME, DATE, DATE, UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 6. rpc_cancelar_serie — cancela a série e só as ocorrências futuras ainda
--    pendentes/confirmadas (a partir de p_a_partir_de, default hoje); o histórico
--    passado nunca é tocado. Cancelar 1 ocorrência isolada já funciona com a policy
--    de UPDATE existente em reservas (dono ou staff) — não precisa de RPC nova.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_cancelar_serie(p_serie_id UUID, p_a_partir_de DATE DEFAULT current_date)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_professor_id UUID;
  v_count INT;
BEGIN
  SELECT professor_id INTO v_professor_id FROM reservas_serie WHERE id = p_serie_id;
  IF v_professor_id IS NULL THEN
    RAISE EXCEPTION 'Série não encontrada.';
  END IF;

  IF NOT (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')
    OR (public.usuario_tem_papel('PROFESSOR') AND v_professor_id IN (SELECT id FROM professores WHERE user_id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar esta série.' USING ERRCODE = '42501';
  END IF;

  UPDATE reservas SET status = 'CANCELADA'
  WHERE serie_id = p_serie_id AND data >= p_a_partir_de AND status IN ('CONFIRMADA', 'PENDENTE');
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE reservas_serie SET status = 'CANCELADA' WHERE id = p_serie_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cancelar_serie(UUID, DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_serie(UUID, DATE) TO authenticated;
