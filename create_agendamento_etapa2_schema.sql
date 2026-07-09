-- ====================================================================================
-- AGENDAMENTO — Expansão (Etapa 2): backend das telas administrativas. Bloqueio/
-- liberação geral já funciona hoje (bloqueios_recurso + BloqueiosTab.tsx já são
-- genéricos, apesar do rótulo de tela dizer "manutenção" — só precisa de ajuste de
-- texto, sem SQL novo). O que falta em backend: por_turma no relatório, dashboard do
-- dia, e as RPCs de importação CSV com dry-run.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. rpc_relatorio_agendamento — adiciona quebra "por_turma" (única lacuna do
--    relatório apontada na spec; uso por recurso/pico/professor/ocupação já existiam).
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
  IF NOT (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
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
    LIMIT 20
  ),
  por_turma AS (
    SELECT t.id, t.nome, count(*) AS total_reservas
    FROM reservas_periodo rp
    JOIN turmas t ON t.id = rp.turma_id
    WHERE rp.status = 'CONFIRMADA'
    GROUP BY t.id, t.nome
    ORDER BY total_reservas DESC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'periodo_dias_uteis', v_dias_uteis,
    'horas_uteis_periodo_por_recurso', v_horas_uteis_periodo,
    'por_recurso', (
      SELECT jsonb_agg(jsonb_build_object(
        'recurso_id', id, 'nome', nome, 'total_reservas', total_reservas,
        'horas_reservadas', round(horas_reservadas::numeric, 1),
        'taxa_ocupacao', CASE WHEN v_horas_uteis_periodo > 0 THEN round((horas_reservadas / v_horas_uteis_periodo * 100)::numeric, 1) ELSE 0 END
      ) ORDER BY horas_reservadas DESC)
      FROM por_recurso
    ),
    'horarios_pico', (SELECT jsonb_agg(jsonb_build_object('hora_inicio', hora_inicio, 'total', total)) FROM picos),
    'por_professor', (SELECT jsonb_agg(jsonb_build_object('professor_id', id, 'nome', nome, 'total_reservas', total_reservas)) FROM por_professor),
    'por_turma', (SELECT jsonb_agg(jsonb_build_object('turma_id', id, 'nome', nome, 'total_reservas', total_reservas)) FROM por_turma)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_relatorio_agendamento(DATE, DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_relatorio_agendamento(DATE, DATE) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 2. rpc_dashboard_dia — visão consolidada do dia por recurso (staff only).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_dashboard_dia(p_data DATE DEFAULT current_date)
RETURNS TABLE (
  recurso_id UUID,
  recurso_nome TEXT,
  reserva_id UUID,
  hora_inicio TIME,
  hora_fim TIME,
  status TEXT,
  professor_nome TEXT,
  turma_nome TEXT,
  finalidade TEXT,
  tema TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para consultar o dashboard do dia.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT rec.id, rec.nome, r.id, r.hora_inicio, r.hora_fim, r.status, p.nome, t.nome, r.finalidade, r.tema
  FROM recursos rec
  LEFT JOIN reservas r ON r.recurso_id = rec.id AND r.data = p_data AND r.status IN ('CONFIRMADA', 'PENDENTE')
  LEFT JOIN professores p ON p.id = r.professor_id
  LEFT JOIN turmas t ON t.id = r.turma_id
  WHERE rec.ativo = true
  ORDER BY rec.ordem, r.hora_inicio;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_dashboard_dia(DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_dashboard_dia(DATE) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 3. Importação CSV de recursos — dry-run (só valida) + importação real (revalida e
--    grava só as linhas válidas e não-duplicadas). "Nunca importar direto sem
--    validar": a própria RPC de importação roda a mesma validação do dry-run antes
--    de cada INSERT, então mesmo pulando a pré-visualização no cliente por engano,
--    o servidor nunca grava lixo.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validar_linha_recurso(p_linha JSONB, p_linha_num INTEGER)
RETURNS TABLE (linha INTEGER, valido BOOLEAN, motivo TEXT, duplicado BOOLEAN, nome TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
  v_tipo TEXT;
BEGIN
  v_nome := trim(p_linha->>'nome');
  v_tipo := upper(trim(coalesce(p_linha->>'tipo', '')));

  IF v_nome IS NULL OR v_nome = '' THEN
    RETURN QUERY SELECT p_linha_num, false, 'Nome é obrigatório.', false, v_nome; RETURN;
  END IF;
  IF v_tipo NOT IN ('LABORATORIO', 'SALA', 'QUADRA', 'EQUIPAMENTO', 'OUTRO') THEN
    RETURN QUERY SELECT p_linha_num, false, format('Tipo inválido: %s (use LABORATORIO/SALA/QUADRA/EQUIPAMENTO/OUTRO).', v_tipo), false, v_nome; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM recursos rec WHERE lower(rec.nome) = lower(v_nome)) THEN
    RETURN QUERY SELECT p_linha_num, false, 'Já existe um recurso com este nome.', true, v_nome; RETURN;
  END IF;

  RETURN QUERY SELECT p_linha_num, true, NULL::TEXT, false, v_nome;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_dry_run_importacao_recursos(p_linhas JSONB)
RETURNS TABLE (linha INTEGER, valido BOOLEAN, motivo TEXT, duplicado BOOLEAN, nome TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_idx INTEGER := 0;
  v_nomes_no_arquivo TEXT[] := '{}';
BEGIN
  IF NOT (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para importar recursos.' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_linhas) LOOP
    v_idx := v_idx + 1;
    IF lower(trim(v_item->>'nome')) = ANY(v_nomes_no_arquivo) THEN
      RETURN QUERY SELECT v_idx, false, 'Nome duplicado dentro do próprio arquivo.'::TEXT, true, trim(v_item->>'nome');
    ELSE
      v_nomes_no_arquivo := array_append(v_nomes_no_arquivo, lower(trim(v_item->>'nome')));
      RETURN QUERY SELECT * FROM fn_validar_linha_recurso(v_item, v_idx);
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_dry_run_importacao_recursos(JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_dry_run_importacao_recursos(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_importar_recursos(p_linhas JSONB)
RETURNS TABLE (linha INTEGER, sucesso BOOLEAN, motivo TEXT, recurso_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_idx INTEGER := 0;
  v_validacao RECORD;
  v_novo_id UUID;
BEGIN
  IF NOT (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para importar recursos.' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_linhas) LOOP
    v_idx := v_idx + 1;
    SELECT * INTO v_validacao FROM fn_validar_linha_recurso(v_item, v_idx);

    IF NOT v_validacao.valido THEN
      RETURN QUERY SELECT v_idx, false, v_validacao.motivo, NULL::UUID;
      CONTINUE;
    END IF;

    INSERT INTO recursos (nome, tipo, descricao, capacidade, local, requer_aprovacao, ativo)
    VALUES (
      trim(v_item->>'nome'),
      upper(trim(v_item->>'tipo')),
      NULLIF(trim(coalesce(v_item->>'descricao', '')), ''),
      NULLIF(v_item->>'capacidade', '')::INTEGER,
      NULLIF(trim(coalesce(v_item->>'local', '')), ''),
      COALESCE((v_item->>'requer_aprovacao')::BOOLEAN, false),
      true
    )
    RETURNING id INTO v_novo_id;

    RETURN QUERY SELECT v_idx, true, NULL::TEXT, v_novo_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_importar_recursos(JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_importar_recursos(JSONB) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. Importação CSV de aulas fixas (séries) — resolve recurso/professor/turma por
--    NOME (mais prático pra planilha que UUID), valida, e o dry-run SIMULA o
--    conflito (mesma regra da EXCLUDE, em modo leitura, sem gravar nada) pra cada
--    ocorrência que a série geraria — pré-visualização honesta antes de gravar de
--    verdade. A importação real reaproveita rpc_criar_serie_recorrente linha a
--    linha (mesmo motor, mesma checagem atômica de conflito).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_dry_run_importacao_series(p_linhas JSONB)
RETURNS TABLE (
  linha INTEGER, valido BOOLEAN, motivo TEXT,
  recurso_nome TEXT, professor_nome TEXT, turma_nome TEXT,
  conflitos_previstos INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_idx INTEGER := 0;
  v_recurso_id UUID;
  v_professor_id UUID;
  v_turma_id UUID;
  v_dia_semana INTEGER;
  v_hora_inicio TIME;
  v_hora_fim TIME;
  v_vigencia_inicio DATE;
  v_vigencia_fim DATE;
  v_offset INT;
  v_data DATE;
  v_conflitos INTEGER;
BEGIN
  IF NOT (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para importar aulas fixas.' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_linhas) LOOP
    v_idx := v_idx + 1;

    SELECT id INTO v_recurso_id FROM recursos WHERE lower(nome) = lower(trim(v_item->>'recurso_nome'));
    SELECT id INTO v_professor_id FROM professores WHERE lower(nome) = lower(trim(v_item->>'professor_nome'));
    v_turma_id := NULL;
    IF v_item ? 'turma_nome' AND trim(v_item->>'turma_nome') != '' THEN
      SELECT id INTO v_turma_id FROM turmas WHERE lower(nome) = lower(trim(v_item->>'turma_nome'));
    END IF;

    IF v_recurso_id IS NULL THEN
      RETURN QUERY SELECT v_idx, false, format('Recurso "%s" não encontrado.', v_item->>'recurso_nome'), v_item->>'recurso_nome', v_item->>'professor_nome', v_item->>'turma_nome', 0;
      CONTINUE;
    END IF;
    IF v_professor_id IS NULL THEN
      RETURN QUERY SELECT v_idx, false, format('Professor "%s" não encontrado.', v_item->>'professor_nome'), v_item->>'recurso_nome', v_item->>'professor_nome', v_item->>'turma_nome', 0;
      CONTINUE;
    END IF;

    BEGIN
      v_dia_semana := (v_item->>'dia_semana')::INTEGER;
      v_hora_inicio := (v_item->>'hora_inicio')::TIME;
      v_hora_fim := (v_item->>'hora_fim')::TIME;
      v_vigencia_inicio := (v_item->>'vigencia_inicio')::DATE;
      v_vigencia_fim := (v_item->>'vigencia_fim')::DATE;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_idx, false, 'Formato inválido em dia_semana/horas/datas.'::TEXT, v_item->>'recurso_nome', v_item->>'professor_nome', v_item->>'turma_nome', 0;
      CONTINUE;
    END;

    IF v_dia_semana NOT BETWEEN 0 AND 6 OR v_hora_fim <= v_hora_inicio OR v_vigencia_fim < v_vigencia_inicio THEN
      RETURN QUERY SELECT v_idx, false, 'Dia da semana, horário ou vigência inconsistentes.'::TEXT, v_item->>'recurso_nome', v_item->>'professor_nome', v_item->>'turma_nome', 0;
      CONTINUE;
    END IF;

    -- Simula (só leitura) quantas ocorrências que a série geraria já colidem com
    -- reservas existentes — mesma regra da EXCLUDE, sem gravar nada.
    v_conflitos := 0;
    v_offset := (v_dia_semana - EXTRACT(DOW FROM v_vigencia_inicio)::int + 7) % 7;
    v_data := v_vigencia_inicio + v_offset;
    WHILE v_data <= v_vigencia_fim LOOP
      IF EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.recurso_id = v_recurso_id AND r.status IN ('CONFIRMADA', 'PENDENTE')
          AND tsrange(r.data + r.hora_inicio, r.data + r.hora_fim) && tsrange(v_data + v_hora_inicio, v_data + v_hora_fim)
      ) THEN
        v_conflitos := v_conflitos + 1;
      END IF;
      v_data := v_data + 7;
    END LOOP;

    RETURN QUERY SELECT v_idx, true, NULL::TEXT, (SELECT nome FROM recursos WHERE id = v_recurso_id), (SELECT nome FROM professores WHERE id = v_professor_id), (SELECT nome FROM turmas WHERE id = v_turma_id), v_conflitos;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_dry_run_importacao_series(JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_dry_run_importacao_series(JSONB) TO authenticated;

-- Importação real: reaproveita rpc_criar_serie_recorrente linha a linha (mesmo
-- motor de numeração de ocorrências e checagem atômica de conflito da Etapa 1).
CREATE OR REPLACE FUNCTION public.rpc_importar_series(p_linhas JSONB)
RETURNS TABLE (linha INTEGER, sucesso BOOLEAN, motivo TEXT, serie_id UUID, ocorrencias_criadas INTEGER, ocorrencias_com_conflito INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_idx INTEGER := 0;
  v_recurso_id UUID;
  v_professor_id UUID;
  v_turma_id UUID;
  v_ocorrencia RECORD;
  v_criadas INTEGER;
  v_conflitos INTEGER;
  v_serie_id UUID;
BEGIN
  IF NOT (public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para importar aulas fixas.' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_linhas) LOOP
    v_idx := v_idx + 1;

    SELECT id INTO v_recurso_id FROM recursos WHERE lower(nome) = lower(trim(v_item->>'recurso_nome'));
    SELECT id INTO v_professor_id FROM professores WHERE lower(nome) = lower(trim(v_item->>'professor_nome'));
    v_turma_id := NULL;
    IF v_item ? 'turma_nome' AND trim(v_item->>'turma_nome') != '' THEN
      SELECT id INTO v_turma_id FROM turmas WHERE lower(nome) = lower(trim(v_item->>'turma_nome'));
    END IF;

    IF v_recurso_id IS NULL OR v_professor_id IS NULL THEN
      RETURN QUERY SELECT v_idx, false, 'Recurso ou professor não encontrado (linha pulada).'::TEXT, NULL::UUID, 0, 0;
      CONTINUE;
    END IF;

    v_criadas := 0;
    v_conflitos := 0;
    v_serie_id := NULL;
    FOR v_ocorrencia IN
      SELECT * FROM rpc_criar_serie_recorrente(
        v_recurso_id, v_professor_id, (v_item->>'dia_semana')::SMALLINT,
        (v_item->>'hora_inicio')::TIME, (v_item->>'hora_fim')::TIME,
        (v_item->>'vigencia_inicio')::DATE, (v_item->>'vigencia_fim')::DATE,
        v_turma_id, v_item->>'finalidade'
      )
    LOOP
      IF v_ocorrencia.sucesso THEN v_criadas := v_criadas + 1; ELSE v_conflitos := v_conflitos + 1; END IF;
    END LOOP;

    SELECT s.id INTO v_serie_id FROM reservas_serie s
      WHERE s.recurso_id = v_recurso_id AND s.professor_id = v_professor_id
      ORDER BY s.criado_em DESC LIMIT 1;

    RETURN QUERY SELECT v_idx, true, NULL::TEXT, v_serie_id, v_criadas, v_conflitos;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_importar_series(JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_importar_series(JSONB) TO authenticated;
