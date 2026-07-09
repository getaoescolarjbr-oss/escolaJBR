-- ====================================================================================
-- GESTÃO ESCOLAR — Sub-módulo 4b: Manutenção Predial (chamados de conserto —
-- elétrica/hidráulica/estrutura/mobiliário). Diferente da manutenção de EQUIPAMENTO
-- do Agendamento (bloqueios_recurso) — aqui é o PRÉDIO, não um recurso reservável.
--
-- "Gerir/fechar — GESTAO (e quem a direção designar)": implementado como
-- `responsavel_id` — GESTAO pode atribuir um chamado a alguém específico, e essa
-- pessoa passa a poder movimentar o status também, sem precisar de um papel novo.
--
-- "Histórico de mudança de status": trigger dedicado (não só a auditoria genérica,
-- que só registra NOMES de campo alterado, não a transição em si) — toda vez que o
-- status muda (inclusive a criação), uma linha nasce em
-- chamados_manutencao_historico, sem depender do cliente lembrar de registrar.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS chamados_manutencao (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo             TEXT NOT NULL,
  descricao          TEXT,
  categoria          TEXT NOT NULL CHECK (categoria IN ('ELETRICA', 'HIDRAULICA', 'ESTRUTURA', 'MOBILIARIO', 'OUTRO')),
  local              TEXT NOT NULL,
  prioridade         TEXT NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA')),
  status             TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO')),
  aberto_por         UUID REFERENCES usuarios(id),
  aberto_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  responsavel_id     UUID REFERENCES usuarios(id),
  -- Gancho pra Fase 2b (Patrimônio) — de propósito SEM FK ainda, a tabela de bens
  -- patrimoniais não existe. Quando existir, uma migração adiciona a constraint.
  bem_patrimonial_id UUID,
  resolvido_em       TIMESTAMPTZ,
  observacoes        TEXT,
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chamados_manutencao_status ON chamados_manutencao (status);

CREATE TABLE IF NOT EXISTS chamados_manutencao_historico (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id      UUID NOT NULL REFERENCES chamados_manutencao(id),
  status_anterior TEXT,
  status_novo     TEXT NOT NULL,
  alterado_por    UUID REFERENCES usuarios(id),
  alterado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao      TEXT
);

CREATE INDEX IF NOT EXISTS idx_chamados_manutencao_historico_chamado ON chamados_manutencao_historico (chamado_id);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id   UUID NOT NULL REFERENCES chamados_manutencao(id),
  responsavel  TEXT NOT NULL,
  custo        NUMERIC,
  data         DATE NOT NULL DEFAULT current_date,
  observacoes  TEXT,
  criado_por   UUID REFERENCES usuarios(id),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chamados_manutencao ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados_manutencao FORCE ROW LEVEL SECURITY;
ALTER TABLE chamados_manutencao_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados_manutencao_historico FORCE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer servidor vê todos os chamados (transparência de "o que já foi
-- aberto" evita chamado duplicado) — nunca ALUNO/RESPONSAVEL.
DROP POLICY IF EXISTS "chamados_manutencao_select" ON chamados_manutencao;
CREATE POLICY "chamados_manutencao_select" ON chamados_manutencao FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
    public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
    public.usuario_tem_papel('INSPETOR')
  );

-- Abrir chamado: qualquer servidor, só em nome de si mesmo.
DROP POLICY IF EXISTS "chamados_manutencao_insert" ON chamados_manutencao;
CREATE POLICY "chamados_manutencao_insert" ON chamados_manutencao FOR INSERT TO authenticated
  WITH CHECK (
    aberto_por = auth.uid() AND (
      public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
      public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
      public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
      public.usuario_tem_papel('INSPETOR')
    )
  );

-- Gerir/fechar: GESTAO, ou quem a GESTAO designou como responsavel_id do chamado.
-- Quem só abriu o chamado (aberto_por) não pode mudar status sozinho, a menos que
-- também seja GESTAO ou tenha sido designado responsável.
DROP POLICY IF EXISTS "chamados_manutencao_update" ON chamados_manutencao;
CREATE POLICY "chamados_manutencao_update" ON chamados_manutencao FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR responsavel_id = auth.uid())
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR responsavel_id = auth.uid());

-- Histórico: mesma visibilidade dos chamados; sem policy de escrita — só o trigger
-- (SECURITY DEFINER) grava.
DROP POLICY IF EXISTS "chamados_manutencao_historico_select" ON chamados_manutencao_historico;
CREATE POLICY "chamados_manutencao_historico_select" ON chamados_manutencao_historico FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
    public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
    public.usuario_tem_papel('INSPETOR')
  );

-- Ordens de serviço (execução formal): leitura igual aos chamados; escrita só GESTAO.
DROP POLICY IF EXISTS "ordens_servico_select" ON ordens_servico;
CREATE POLICY "ordens_servico_select" ON ordens_servico FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
    public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
    public.usuario_tem_papel('INSPETOR')
  );

DROP POLICY IF EXISTS "ordens_servico_write" ON ordens_servico;
CREATE POLICY "ordens_servico_write" ON ordens_servico FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

-- ------------------------------------------------------------------------------------
-- Trigger de histórico: registra a criação (status_anterior NULL) e toda transição de
-- status — não dá pra pular passando por fora do cliente, porque é BEFORE
-- INSERT/UPDATE no banco. Também mantém atualizado_em e preenche resolvido_em
-- automaticamente ao concluir.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_manutencao_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO chamados_manutencao_historico (chamado_id, status_anterior, status_novo, alterado_por)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO chamados_manutencao_historico (chamado_id, status_anterior, status_novo, alterado_por)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
    NEW.atualizado_em := now();
    IF NEW.status = 'CONCLUIDO' AND NEW.resolvido_em IS NULL THEN
      NEW.resolvido_em := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Precisa ser dois triggers, não um: no INSERT, a linha em chamados_manutencao só
-- passa a existir de fato DEPOIS que o INSERT roda — um BEFORE INSERT tentando gravar
-- o histórico nesse momento viola a FK (chamado_id ainda não existe na tabela). Por
-- isso o histórico da criação é AFTER INSERT; já a transição de status precisa ser
-- BEFORE UPDATE, porque também ajusta atualizado_em/resolvido_em em NEW antes de
-- gravar (AFTER não permite mais alterar NEW).
DROP TRIGGER IF EXISTS trg_chamado_manutencao_historico ON chamados_manutencao;
DROP TRIGGER IF EXISTS trg_chamado_manutencao_historico_insert ON chamados_manutencao;
DROP TRIGGER IF EXISTS trg_chamado_manutencao_historico_update ON chamados_manutencao;
CREATE TRIGGER trg_chamado_manutencao_historico_insert
  AFTER INSERT ON chamados_manutencao
  FOR EACH ROW EXECUTE FUNCTION public.fn_chamado_manutencao_historico();
CREATE TRIGGER trg_chamado_manutencao_historico_update
  BEFORE UPDATE ON chamados_manutencao
  FOR EACH ROW EXECUTE FUNCTION public.fn_chamado_manutencao_historico();

DROP TRIGGER IF EXISTS trg_auditoria_chamados_manutencao ON chamados_manutencao;
CREATE TRIGGER trg_auditoria_chamados_manutencao
  AFTER INSERT OR UPDATE OR DELETE ON chamados_manutencao
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_ordens_servico ON ordens_servico;
CREATE TRIGGER trg_auditoria_ordens_servico
  AFTER INSERT OR UPDATE OR DELETE ON ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- Estende rpc_indicadores_gestao_escolar (mesma função, GESTAO-only, já testada) com
-- os dois novos "alimenta um card na Gestão" pedidos nesta fase:
--   - Almoxarifado: quantos materiais ativos estão no mínimo ou abaixo dele.
--   - Manutenção: quantos chamados estão abertos/em andamento.
-- "Atrasados" (mencionado no pedido original) fica de fora por enquanto: não há
-- prazo/SLA definido no modelo pra calcular atraso sem inventar um número — avise se
-- quiser definir um limiar (ex.: "ALTA sem solução em X dias") pra eu adicionar.
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

    'financeiro', jsonb_build_object('sem_dados', true, 'motivo', 'sub-módulo financeiro (PDDE/APM) ainda não existe'),

    'gerado_em', now()

  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
