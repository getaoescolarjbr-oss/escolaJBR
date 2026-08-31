-- ====================================================================================
-- MÓDULO AGENDAMENTO — Concessão de permissões de gerenciamento para o papel PCPI.
--
-- PRÉ-REQUISITO: rodar alter_papel_usuario_add_pcpi.sql ANTES deste arquivo.
--
-- O PCPI (Professor Coordenador de Práticas Inovadoras) é o gestor direto dos
-- recursos tecnológicos e pedagógicos da escola (laboratórios, salas, equipamentos).
-- Este script concede ao PCPI permissões completas de:
--   1. Cadastro, edição e exclusão de recursos (tabela `recursos`);
--   2. Criação, liberação e exclusão de bloqueios (tabela `bloqueios_recurso`);
--   3. Aprovação, recusa, edição e agendamento de reservas (tabela `reservas` e RPCs);
--   4. Gestão de campos personalizados e recursos compartilhados;
--   5. Acesso a relatórios, dashboard do dia e importações CSV.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. TABELA recursos — RLS
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "recursos_write_coordenacao_gestao" ON recursos;
CREATE POLICY "recursos_write_coordenacao_gestao_pcpi" ON recursos
  FOR INSERT
  WITH CHECK (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

DROP POLICY IF EXISTS "recursos_update_coordenacao_gestao" ON recursos;
CREATE POLICY "recursos_update_coordenacao_gestao_pcpi" ON recursos
  FOR UPDATE
  USING (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  )
  WITH CHECK (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

DROP POLICY IF EXISTS "recursos_delete_coordenacao_gestao" ON recursos;
CREATE POLICY "recursos_delete_coordenacao_gestao_pcpi" ON recursos
  FOR DELETE
  USING (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

-- ------------------------------------------------------------------------------------
-- 2. TABELA reservas — RLS
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "reservas_select_papeis_permitidos" ON reservas;
CREATE POLICY "reservas_select_papeis_permitidos" ON reservas
  FOR SELECT
  USING (
    public.usuario_tem_papel('PROFESSOR')
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

DROP POLICY IF EXISTS "reservas_insert_papeis_permitidos" ON reservas;
CREATE POLICY "reservas_insert_papeis_permitidos" ON reservas
  FOR INSERT
  WITH CHECK (
    (
      public.usuario_tem_papel('COORDENACAO')
      OR public.usuario_tem_papel('GESTAO')
      OR public.usuario_tem_papel('PCPI')
    )
    OR (
      public.usuario_tem_papel('PROFESSOR')
      AND professor_id IN (SELECT id FROM professores WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "reservas_update_dono_ou_staff" ON reservas;
CREATE POLICY "reservas_update_dono_ou_staff" ON reservas
  FOR UPDATE
  USING (
    professor_id IN (SELECT id FROM professores WHERE user_id = auth.uid())
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  )
  WITH CHECK (
    status = 'CANCELADA'
    OR public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

-- ------------------------------------------------------------------------------------
-- 3. TABELA bloqueios_recurso — RLS
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "bloqueios_recurso_rw_coordenacao_gestao" ON bloqueios_recurso;
CREATE POLICY "bloqueios_recurso_rw_coordenacao_gestao_pcpi" ON bloqueios_recurso
  FOR ALL
  USING (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  )
  WITH CHECK (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

-- ------------------------------------------------------------------------------------
-- 4. TABELAS recursos_compartilhados e recursos_campos_personalizados (se existirem)
-- ------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recursos_compartilhados') THEN
    DROP POLICY IF EXISTS "recursos_compartilhados_select" ON recursos_compartilhados;
    CREATE POLICY "recursos_compartilhados_select" ON recursos_compartilhados
      FOR SELECT
      USING (
        public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('GESTAO')
        OR public.usuario_tem_papel('PCPI')
        OR professor_id IN (SELECT id FROM professores WHERE user_id = auth.uid())
      );

    DROP POLICY IF EXISTS "recursos_compartilhados_write" ON recursos_compartilhados;
    CREATE POLICY "recursos_compartilhados_write" ON recursos_compartilhados
      FOR ALL
      USING (
        compartilhado_por = auth.uid()
        OR public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('GESTAO')
        OR public.usuario_tem_papel('PCPI')
      );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recursos_campos_personalizados') THEN
    DROP POLICY IF EXISTS "recursos_campos_personalizados_write" ON recursos_campos_personalizados;
    CREATE POLICY "recursos_campos_personalizados_write" ON recursos_campos_personalizados
      FOR ALL
      USING (
        public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('GESTAO')
        OR public.usuario_tem_papel('PCPI')
      )
      WITH CHECK (
        public.usuario_tem_papel('COORDENACAO')
        OR public.usuario_tem_papel('GESTAO')
        OR public.usuario_tem_papel('PCPI')
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------------
-- 5. RPCs DE APROVAÇÃO / RECUSA (Etapa 5)
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_aprovar_reserva(p_reserva_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reserva RECORD;
  v_usuario_id UUID := auth.uid();
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar reservas.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_reserva.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'Apenas reservas com status PENDENTE podem ser aprovadas.' USING ERRCODE = '22023';
  END IF;

  UPDATE reservas
  SET status = 'CONFIRMADA',
      aprovado_por = v_usuario_id,
      aprovado_em = now(),
      atualizado_em = now()
  WHERE id = p_reserva_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_reserva_id,
    'status', 'CONFIRMADA'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_recusar_reserva(p_reserva_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reserva RECORD;
  v_usuario_id UUID := auth.uid();
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para recusar reservas.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_reserva FROM reservas WHERE id = p_reserva_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_reserva.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'Apenas reservas com status PENDENTE podem ser recusadas.' USING ERRCODE = '22023';
  END IF;

  UPDATE reservas
  SET status = 'RECUSADA',
      aprovado_por = v_usuario_id,
      aprovado_em = now(),
      finalidade = CASE
        WHEN p_motivo IS NOT NULL AND length(trim(p_motivo)) > 0
        THEN COALESCE(finalidade, '') || E'\n[Recusada: ' || trim(p_motivo) || ']'
        ELSE finalidade
      END,
      atualizado_em = now()
  WHERE id = p_reserva_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_reserva_id,
    'status', 'RECUSADA'
  );
END;
$$;

-- ------------------------------------------------------------------------------------
-- 6. RPCs DE RELATÓRIO E DASHBOARD (Etapa 2)
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_relatorio_agendamento(p_data_inicio date, p_data_fim date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
  v_dias_uteis INTEGER;
  v_horas_uteis_periodo NUMERIC;
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consultar relatórios de agendamento.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_dias_uteis
  FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') d
  WHERE extract(isodow FROM d) BETWEEN 1 AND 5;

  v_horas_uteis_periodo := v_dias_uteis * (400.0 / 60.0);

  WITH reservas_periodo AS (
    SELECT r.*, EXTRACT(EPOCH FROM (r.hora_fim - r.hora_inicio)) / 3600.0 AS horas
    FROM reservas r
    WHERE r.data BETWEEN p_data_inicio AND p_data_fim
  ),
  por_recurso AS (
    SELECT
      rec.id, rec.nome,
      count(*) FILTER (WHERE rp.status = 'CONFIRMADA') AS total_reservas,
      COALESCE(SUM(rp.horas) FILTER (WHERE rp.status = 'CONFIRMADA'), 0) AS horas_reservadas
    FROM recursos rec
    LEFT JOIN reservas_periodo rp ON rp.recurso_id = rec.id
    GROUP BY rec.id, rec.nome
  ),
  picos AS (
    SELECT hora_inicio, count(*) AS total
    FROM reservas_periodo
    WHERE status = 'CONFIRMADA'
    GROUP BY hora_inicio
    ORDER BY total DESC
    LIMIT 5
  ),
  por_professor AS (
    SELECT p.id, p.nome, count(*) AS total_reservas
    FROM reservas_periodo rp
    JOIN professores p ON p.id = rp.professor_id
    WHERE rp.status = 'CONFIRMADA'
    GROUP BY p.id, p.nome
    ORDER BY total_reservas DESC
    LIMIT 10
  ),
  por_turma AS (
    SELECT t.id, t.nome, count(*) AS total_reservas
    FROM reservas_periodo rp
    JOIN turmas t ON t.id = rp.turma_id
    WHERE rp.status = 'CONFIRMADA'
    GROUP BY t.id, t.nome
    ORDER BY total_reservas DESC
    LIMIT 10
  ),
  totais AS (
    SELECT
      count(*) AS total_reservas,
      count(*) FILTER (WHERE status = 'CONFIRMADA') AS confirmadas,
      count(*) FILTER (WHERE status = 'PENDENTE') AS pendentes,
      count(*) FILTER (WHERE status = 'RECUSADA') AS recusadas,
      count(*) FILTER (WHERE status = 'CANCELADA') AS canceladas,
      COALESCE(SUM(horas) FILTER (WHERE status = 'CONFIRMADA'), 0) AS total_horas
    FROM reservas_periodo
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim, 'dias_uteis', v_dias_uteis, 'horas_uteis_periodo', v_horas_uteis_periodo),
    'totais', (SELECT to_jsonb(t) FROM totais t),
    'por_recurso', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'nome', pr.nome,
        'total_reservas', pr.total_reservas,
        'horas_reservadas', pr.horas_reservadas,
        'taxa_ocupacao', CASE WHEN v_horas_uteis_periodo > 0 THEN round((pr.horas_reservadas / v_horas_uteis_periodo) * 100, 1) ELSE 0 END
      )) FROM por_recurso pr
    ),
    'horarios_pico', (
      SELECT jsonb_agg(jsonb_build_object('hora', p.hora_inicio, 'total', p.total)) FROM picos p
    ),
    'por_professor', (
      SELECT jsonb_agg(jsonb_build_object('id', pp.id, 'nome', pp.nome, 'total_reservas', pp.total_reservas)) FROM por_professor pp
    ),
    'por_turma', (
      SELECT jsonb_agg(jsonb_build_object('id', pt.id, 'nome', pt.nome, 'total_reservas', pt.total_reservas)) FROM por_turma pt
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_dashboard_dia(p_data date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (
    public.usuario_tem_papel('COORDENACAO')
    OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consultar dashboard diário.' USING ERRCODE = '42501';
  END IF;

  WITH reservas_hoje AS (
    SELECT
      r.id,
      r.hora_inicio,
      r.hora_fim,
      r.status,
      r.finalidade,
      rec.id AS recurso_id,
      rec.nome AS recurso_nome,
      rec.tipo AS recurso_tipo,
      rec.cor AS recurso_cor,
      p.id AS professor_id,
      p.nome AS professor_nome,
      t.id AS turma_id,
      t.nome AS turma_nome
    FROM reservas r
    JOIN recursos rec ON rec.id = r.recurso_id
    JOIN professores p ON p.id = r.professor_id
    LEFT JOIN turmas t ON t.id = r.turma_id
    WHERE r.data = p_data
  ),
  bloqueios_hoje AS (
    SELECT
      b.id,
      b.motivo,
      rec.id AS recurso_id,
      rec.nome AS recurso_nome
    FROM bloqueios_recurso b
    JOIN recursos rec ON rec.id = b.recurso_id
    WHERE p_data BETWEEN b.data_inicio AND b.data_fim
  )
  SELECT jsonb_build_object(
    'data', p_data,
    'metricas', jsonb_build_object(
      'total_reservas', (SELECT count(*) FROM reservas_hoje),
      'confirmadas', (SELECT count(*) FROM reservas_hoje WHERE status = 'CONFIRMADA'),
      'pendentes', (SELECT count(*) FROM reservas_hoje WHERE status = 'PENDENTE'),
      'recursos_bloqueados', (SELECT count(*) FROM bloqueios_hoje)
    ),
    'cronograma', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'hora_inicio', r.hora_inicio,
        'hora_fim', r.hora_fim,
        'status', r.status,
        'finalidade', r.finalidade,
        'recurso', jsonb_build_object('id', r.recurso_id, 'nome', r.recurso_nome, 'tipo', r.recurso_tipo, 'cor', r.recurso_cor),
        'professor', jsonb_build_object('id', r.professor_id, 'nome', r.professor_nome),
        'turma', CASE WHEN r.turma_id IS NOT NULL THEN jsonb_build_object('id', r.turma_id, 'nome', r.turma_nome) ELSE NULL END
      ) ORDER BY r.hora_inicio) FROM reservas_hoje r
    ),
    'bloqueios', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'motivo', b.motivo,
        'recurso', jsonb_build_object('id', b.recurso_id, 'nome', b.recurso_nome)
      )) FROM bloqueios_hoje b
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
