-- ====================================================================================
-- GESTÃO ESCOLAR — Fase 2b: Patrimônio (bens da escola — mobiliário, equipamentos,
-- eletrodomésticos, veículos). Fecha o gancho deixado em chamados_manutencao
-- (bem_patrimonial_id, sem FK até agora) e segue o mesmo padrão de
-- Almoxarifado/Manutenção: catálogo com leitura ampla (qualquer servidor) e escrita
-- restrita a GESTAO/SECRETARIA — bem patrimonial não é dado pessoal (diferente de
-- Portaria/Visitantes), então não precisa da trava mais restrita daquele sub-módulo.
--
-- Sem spec detalhada pra este módulo (só o gancho foi pedido explicitamente) — desenhei
-- por analogia direta com os 3 sub-módulos anteriores. Categorias/situações abaixo são
-- a minha melhor suposição; ajuste fácil depois via CHECK se não bater com a realidade
-- da escola.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS bens_patrimoniais (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_patrimonio  TEXT NOT NULL UNIQUE, -- nº de tombamento
  nome               TEXT NOT NULL,
  descricao          TEXT,
  categoria          TEXT NOT NULL CHECK (categoria IN ('MOBILIARIO', 'EQUIPAMENTO_ELETRONICO', 'ELETRODOMESTICO', 'VEICULO', 'OUTRO')),
  local_atual        TEXT NOT NULL,
  responsavel_id     UUID REFERENCES usuarios(id),
  data_aquisicao     DATE,
  valor_aquisicao    NUMERIC,
  fonte_recurso      TEXT, -- ex.: 'PDDE', 'APM', 'Doação'
  situacao           TEXT NOT NULL DEFAULT 'EM_USO' CHECK (situacao IN ('EM_USO', 'EM_MANUTENCAO', 'BAIXADO', 'EXTRAVIADO')),
  observacoes        TEXT,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  criado_por         UUID REFERENCES usuarios(id),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bens_patrimoniais_situacao ON bens_patrimoniais (situacao);

-- Fecha o gancho deixado na Fase 4b: agora que a tabela existe, a coluna ganha a FK.
ALTER TABLE chamados_manutencao
  ADD CONSTRAINT chamados_manutencao_bem_patrimonial_id_fkey
  FOREIGN KEY (bem_patrimonial_id) REFERENCES bens_patrimoniais(id);

CREATE TABLE IF NOT EXISTS bens_patrimoniais_historico (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bem_id         UUID NOT NULL REFERENCES bens_patrimoniais(id),
  campo          TEXT NOT NULL CHECK (campo IN ('CRIACAO', 'SITUACAO', 'LOCAL')),
  valor_anterior TEXT,
  valor_novo     TEXT NOT NULL,
  alterado_por   UUID REFERENCES usuarios(id),
  alterado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bens_patrimoniais_historico_bem ON bens_patrimoniais_historico (bem_id);

ALTER TABLE bens_patrimoniais ENABLE ROW LEVEL SECURITY;
ALTER TABLE bens_patrimoniais FORCE ROW LEVEL SECURITY;
ALTER TABLE bens_patrimoniais_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE bens_patrimoniais_historico FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bens_patrimoniais_select" ON bens_patrimoniais;
CREATE POLICY "bens_patrimoniais_select" ON bens_patrimoniais FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
    public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
    public.usuario_tem_papel('INSPETOR')
  );

DROP POLICY IF EXISTS "bens_patrimoniais_write" ON bens_patrimoniais;
CREATE POLICY "bens_patrimoniais_write" ON bens_patrimoniais FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP POLICY IF EXISTS "bens_patrimoniais_historico_select" ON bens_patrimoniais_historico;
CREATE POLICY "bens_patrimoniais_historico_select" ON bens_patrimoniais_historico FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
    public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
    public.usuario_tem_papel('INSPETOR')
  );
-- Sem policy de escrita em histórico — só o trigger (SECURITY DEFINER) grava.

-- ------------------------------------------------------------------------------------
-- Mesmo padrão de dois triggers do chamado de manutenção: AFTER INSERT (a linha só
-- existe DEPOIS do INSERT — um BEFORE aqui violaria a FK do histórico) e BEFORE
-- UPDATE (registra mudança de situação/local e atualiza atualizado_em).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_bem_patrimonial_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bens_patrimoniais_historico (bem_id, campo, valor_anterior, valor_novo, alterado_por)
    VALUES (NEW.id, 'CRIACAO', NULL, NEW.situacao, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.situacao IS DISTINCT FROM OLD.situacao THEN
      INSERT INTO bens_patrimoniais_historico (bem_id, campo, valor_anterior, valor_novo, alterado_por)
      VALUES (NEW.id, 'SITUACAO', OLD.situacao, NEW.situacao, auth.uid());
    END IF;
    IF NEW.local_atual IS DISTINCT FROM OLD.local_atual THEN
      INSERT INTO bens_patrimoniais_historico (bem_id, campo, valor_anterior, valor_novo, alterado_por)
      VALUES (NEW.id, 'LOCAL', OLD.local_atual, NEW.local_atual, auth.uid());
    END IF;
    NEW.atualizado_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bem_patrimonial_historico_insert ON bens_patrimoniais;
DROP TRIGGER IF EXISTS trg_bem_patrimonial_historico_update ON bens_patrimoniais;
CREATE TRIGGER trg_bem_patrimonial_historico_insert
  AFTER INSERT ON bens_patrimoniais
  FOR EACH ROW EXECUTE FUNCTION public.fn_bem_patrimonial_historico();
CREATE TRIGGER trg_bem_patrimonial_historico_update
  BEFORE UPDATE ON bens_patrimoniais
  FOR EACH ROW EXECUTE FUNCTION public.fn_bem_patrimonial_historico();

DROP TRIGGER IF EXISTS trg_auditoria_bens_patrimoniais ON bens_patrimoniais;
CREATE TRIGGER trg_auditoria_bens_patrimoniais
  AFTER INSERT OR UPDATE OR DELETE ON bens_patrimoniais
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- Estende rpc_indicadores_gestao_escolar (mesma função, GESTAO-only) com o card de
-- Patrimônio: quantos bens estão em manutenção agora.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_indicadores_gestao_escolar()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado JSONB;
  v_total_matriculas INTEGER;
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Sem permissão para consultar indicadores de Gestão Escolar.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_matriculas FROM matriculas;

  SELECT jsonb_build_object(

    'academico', jsonb_build_object(
      'alunos_por_status', (
        SELECT COALESCE(jsonb_object_agg(status, total), '{}'::jsonb)
        FROM (SELECT status, count(*) AS total FROM alunos GROUP BY status) s
      ),
      'ocorrencias_30_dias', jsonb_build_object(
        'total', (SELECT count(*) FROM "ocorrências" WHERE data >= current_date - 30),
        'sem_visto_coordenador', (SELECT count(*) FROM "ocorrências" WHERE data >= current_date - 30 AND visto_coordenador IS NOT TRUE)
      ),
      'servidores_atestado_ativo', (SELECT count(*) FROM atestados_servidores WHERE ativo = true),
      'infrequencia_alunos', (
        SELECT count(*) FROM (
          SELECT aluno_id, count(*) AS total, count(*) FILTER (WHERE presenca) AS presentes
          FROM chamadas
          GROUP BY aluno_id
          HAVING count(*) >= 5 AND count(*) FILTER (WHERE presenca)::numeric / count(*) < 0.75
        ) infreq
      ),
      'dias_letivos', jsonb_build_object('sem_dados', true, 'motivo', 'calendário letivo não é registrado dia a dia no banco'),
      'situacao_turmas', jsonb_build_object('sem_dados', true, 'motivo', 'não há situação final (aprovado/reprovado/abandono) registrada em matrículas ou notas')
    ),

    'secretaria', jsonb_build_object(
      'documentos_emitidos_30_dias', (SELECT count(*) FROM documentos_emitidos WHERE emitido_em >= now() - interval '30 days'),
      'protocolos_por_status', (
        SELECT COALESCE(jsonb_object_agg(status, total), '{}'::jsonb)
        FROM (SELECT status, count(*) AS total FROM protocolos GROUP BY status) s
      ),
      'divergencias_matricula', jsonb_build_object(
        'total', (SELECT count(*) FROM rpc_divergencias_matricula(NULL)),
        'matriculas_registradas', v_total_matriculas
      )
    ),

    'biblioteca', jsonb_build_object(
      'emprestimos_ativos', (SELECT count(*) FROM emprestimos WHERE status = 'ATIVO'),
      'alunos_biblioclube', (SELECT count(*) FROM usuario_papeis WHERE papel = 'ALUNO'),
      'denuncias_abertas', (SELECT count(*) FROM denuncias WHERE status = 'ABERTA'),
      'resenhas_ocultas_revisao', (SELECT count(*) FROM resenhas WHERE status = 'OCULTA'),
      'resgates_pendentes', (SELECT count(*) FROM resgates WHERE status = 'PENDENTE')
    ),

    'operacional', jsonb_build_object(
      'lotes_vencendo_7_dias', (SELECT count(*) FROM estoque_lotes WHERE validade BETWEEN current_date AND current_date + 7),
      'refeicoes_servidas_30_dias', (SELECT COALESCE(sum(quantidade_alunos), 0) FROM refeicoes_servidas WHERE criado_em >= now() - interval '30 days'),
      'reservas_pendentes', (SELECT count(*) FROM reservas WHERE status = 'PENDENTE'),
      'frequencia_servidores_hoje', jsonb_build_object('sem_dados', true, 'motivo', 'não há registro de ponto/presença diária de servidores no banco')
    ),

    'almoxarifado', jsonb_build_object(
      'materiais_abaixo_minimo', (
        SELECT count(*) FROM materiais m
        JOIN vw_saldo_material s ON s.material_id = m.id
        WHERE m.ativo = true AND s.saldo <= m.estoque_minimo
      )
    ),

    'manutencao', jsonb_build_object(
      'chamados_abertos', (SELECT count(*) FROM chamados_manutencao WHERE status IN ('ABERTO', 'EM_ANDAMENTO')),
      'chamados_atrasados', jsonb_build_object('sem_dados', true, 'motivo', 'sem prazo/SLA definido no modelo ainda — avise o limiar desejado')
    ),

    'portaria', jsonb_build_object(
      'visitantes_presentes', (SELECT count(*) FROM visitantes WHERE saida_em IS NULL)
    ),

    'patrimonio', jsonb_build_object(
      'bens_em_manutencao', (SELECT count(*) FROM bens_patrimoniais WHERE situacao = 'EM_MANUTENCAO' AND ativo = true)
    ),

    'financeiro', jsonb_build_object('sem_dados', true, 'motivo', 'sub-módulo financeiro (PDDE/APM) ainda não existe'),

    'gerado_em', now()

  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
