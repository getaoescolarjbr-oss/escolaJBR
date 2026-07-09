-- ====================================================================================
-- MÓDULO AGENDAMENTO DE RECURSOS — Etapa 1: modelo de dados, RLS, RPC pública e
-- constraint de exclusão (prevenção de conflito atômica). Execute no Painel do
-- Supabase > SQL Editor, depois de todos os scripts create_fundacao_*.
-- Serviços e telas vêm nas próximas entregas, depois desta revisão.
-- ====================================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------------------------------
-- 1. recursos — leitura PÚBLICA (nome de laboratório/quadra não é dado sensível).
--    Escrita só COORDENACAO/GESTAO.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recursos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT NOT NULL,
  tipo              TEXT NOT NULL CHECK (tipo IN ('LABORATORIO', 'SALA', 'QUADRA', 'EQUIPAMENTO', 'OUTRO')),
  descricao         TEXT,
  capacidade        INTEGER,
  local             TEXT,
  icone             TEXT,
  cor               TEXT,
  ordem             INTEGER NOT NULL DEFAULT 0,
  requer_aprovacao  BOOLEAN NOT NULL DEFAULT false,
  ativo             BOOLEAN NOT NULL DEFAULT true,
  em_manutencao     BOOLEAN NOT NULL DEFAULT false,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recursos_select_publico" ON recursos;
CREATE POLICY "recursos_select_publico" ON recursos
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "recursos_write_coordenacao_gestao" ON recursos;
CREATE POLICY "recursos_write_coordenacao_gestao" ON recursos
  FOR INSERT
  WITH CHECK (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "recursos_update_coordenacao_gestao" ON recursos;
CREATE POLICY "recursos_update_coordenacao_gestao" ON recursos
  FOR UPDATE
  USING (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "recursos_delete_coordenacao_gestao" ON recursos;
CREATE POLICY "recursos_delete_coordenacao_gestao" ON recursos
  FOR DELETE
  USING (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

DROP TRIGGER IF EXISTS trg_auditoria_recursos ON recursos;
CREATE TRIGGER trg_auditoria_recursos
  AFTER INSERT OR UPDATE OR DELETE ON recursos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- Seed inicial (os 3 recursos já referenciados na home)
INSERT INTO recursos (nome, tipo, capacidade, local, cor, ordem, requer_aprovacao)
VALUES
  ('Laboratório de Ciências', 'LABORATORIO', 35, 'Bloco B', '#16a34a', 1, false),
  ('Laboratório de Informática', 'LABORATORIO', 30, 'Bloco A', '#2563eb', 2, false),
  ('Quadra Esportiva', 'QUADRA', 60, 'Área Externa', '#d97706', 3, true)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------------
-- 2. reservas — SELECT detalhado só para papéis permitidos. Público usa a RPC (item 5).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id    UUID NOT NULL REFERENCES recursos(id),
  professor_id  UUID NOT NULL REFERENCES professores(id),
  turma_id      UUID REFERENCES turmas(id),
  finalidade    TEXT,
  data          DATE NOT NULL,
  hora_inicio   TIME NOT NULL,
  hora_fim      TIME NOT NULL,
  status        TEXT NOT NULL DEFAULT 'CONFIRMADA' CHECK (status IN ('CONFIRMADA', 'PENDENTE', 'RECUSADA', 'CANCELADA')),
  aprovado_por  UUID REFERENCES usuarios(id),
  aprovado_em   TIMESTAMPTZ,
  criado_por    UUID NOT NULL REFERENCES usuarios(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_reservas_recurso_data ON reservas (recurso_id, data);
CREATE INDEX IF NOT EXISTS idx_reservas_professor ON reservas (professor_id);

-- ------------------------------------------------------------------------------------
-- 3. Prevenção de conflito ATÔMICA — exatamente o mecanismo pedido: constraint de
--    exclusão no Postgres, não checagem no cliente. Duas reservas simultâneas no
--    mesmo recurso/horário nunca coexistem como CONFIRMADA/PENDENTE — o Postgres
--    rejeita a segunda com erro de exclusão (código 23P01), tratado na Etapa 4.
-- ------------------------------------------------------------------------------------
ALTER TABLE reservas
  ADD CONSTRAINT reservas_sem_sobreposicao
  EXCLUDE USING gist (
    recurso_id WITH =,
    tsrange((data + hora_inicio)::timestamp, (data + hora_fim)::timestamp) WITH &&
  )
  WHERE (status IN ('CONFIRMADA', 'PENDENTE'));

ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- SELECT detalhado: só quem tem papel de reservar.
DROP POLICY IF EXISTS "reservas_select_papeis_permitidos" ON reservas;
CREATE POLICY "reservas_select_papeis_permitidos" ON reservas
  FOR SELECT
  USING (
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
  );

-- INSERT: PROFESSOR só reserva para si mesmo; COORDENACAO/GESTAO reservam para qualquer professor.
DROP POLICY IF EXISTS "reservas_insert_papeis_permitidos" ON reservas;
CREATE POLICY "reservas_insert_papeis_permitidos" ON reservas
  FOR INSERT
  WITH CHECK (
    (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
    OR (
      public.usuario_tem_papel('PROFESSOR')
      AND professor_id IN (SELECT id FROM professores WHERE user_id = auth.uid())
    )
  );

-- UPDATE: dono da reserva (via professores.user_id) ou COORDENACAO/GESTAO podem mexer;
-- mas só COORDENACAO/GESTAO podem fazer a transição para CONFIRMADA/RECUSADA (aprovação) —
-- o dono só pode levar ao status CANCELADA.
DROP POLICY IF EXISTS "reservas_update_dono_ou_staff" ON reservas;
CREATE POLICY "reservas_update_dono_ou_staff" ON reservas
  FOR UPDATE
  USING (
    professor_id IN (SELECT id FROM professores WHERE user_id = auth.uid())
    OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
  )
  WITH CHECK (
    status = 'CANCELADA'
    OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
  );

-- Sem policy de DELETE: cancelamento é status=CANCELADA (mantém histórico/auditoria).

DROP TRIGGER IF EXISTS trg_auditoria_reservas ON reservas;
CREATE TRIGGER trg_auditoria_reservas
  AFTER INSERT OR UPDATE OR DELETE ON reservas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 4. bloqueios_recurso — indisponibilidade/manutenção, por dia inteiro.
--    Trigger garante que também impede reserva sobreposta (não dá pra usar o mesmo
--    EXCLUDE nativo entre tabelas diferentes com granularidades diferentes).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bloqueios_recurso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id  UUID NOT NULL REFERENCES recursos(id),
  data_inicio DATE NOT NULL,
  data_fim    DATE NOT NULL,
  motivo      TEXT,
  criado_por  UUID NOT NULL REFERENCES usuarios(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS idx_bloqueios_recurso_periodo ON bloqueios_recurso (recurso_id, data_inicio, data_fim);

ALTER TABLE bloqueios_recurso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bloqueios_recurso_rw_coordenacao_gestao" ON bloqueios_recurso;
CREATE POLICY "bloqueios_recurso_rw_coordenacao_gestao" ON bloqueios_recurso
  FOR ALL
  USING (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

DROP TRIGGER IF EXISTS trg_auditoria_bloqueios_recurso ON bloqueios_recurso;
CREATE TRIGGER trg_auditoria_bloqueios_recurso
  AFTER INSERT OR UPDATE OR DELETE ON bloqueios_recurso
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- Trigger em reservas: rejeita INSERT/UPDATE que caia dentro de um bloqueio do recurso.
CREATE OR REPLACE FUNCTION public.fn_reserva_bloqueia_manutencao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('CONFIRMADA', 'PENDENTE') AND EXISTS (
    SELECT 1 FROM bloqueios_recurso b
    WHERE b.recurso_id = NEW.recurso_id
      AND NEW.data BETWEEN b.data_inicio AND b.data_fim
  ) THEN
    RAISE EXCEPTION 'Recurso indisponível nesta data (bloqueio de manutenção).' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reserva_bloqueia_manutencao ON reservas;
CREATE TRIGGER trg_reserva_bloqueia_manutencao
  BEFORE INSERT OR UPDATE ON reservas
  FOR EACH ROW EXECUTE FUNCTION public.fn_reserva_bloqueia_manutencao();

-- ------------------------------------------------------------------------------------
-- 5. RPC pública de disponibilidade — só livre/ocupado, SEM professor/turma/finalidade.
--    SECURITY DEFINER: bypassa a RLS de `reservas`/`bloqueios_recurso` internamente,
--    mas só devolve os 4 campos abaixo — é isso que a home (usuário anônimo) chama.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_disponibilidade(p_recurso_id UUID, p_data_inicio DATE, p_data_fim DATE)
RETURNS TABLE (data DATE, hora_inicio TIME, hora_fim TIME, tipo TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT r.data, r.hora_inicio, r.hora_fim, 'RESERVA'::text AS tipo
  FROM reservas r
  WHERE r.recurso_id = p_recurso_id
    AND r.status IN ('CONFIRMADA', 'PENDENTE')
    AND r.data BETWEEN p_data_inicio AND p_data_fim

  UNION ALL

  SELECT gs::date AS data, '00:00'::time AS hora_inicio, '23:59'::time AS hora_fim, 'BLOQUEIO'::text AS tipo
  FROM bloqueios_recurso b,
       generate_series(GREATEST(b.data_inicio, p_data_inicio), LEAST(b.data_fim, p_data_fim), interval '1 day') gs
  WHERE b.recurso_id = p_recurso_id
    AND b.data_inicio <= p_data_fim
    AND b.data_fim >= p_data_inicio;
$$;

REVOKE ALL ON FUNCTION public.get_disponibilidade(UUID, DATE, DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.get_disponibilidade(UUID, DATE, DATE) TO anon, authenticated;
