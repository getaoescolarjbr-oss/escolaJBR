-- ====================================================================================
-- GESTÃO ESCOLAR — Sub-módulo 4c: Portaria / Visitantes.
--
-- Diferença deliberada em relação a Almoxarifado (4a) e Manutenção (4b): lá, "qualquer
-- servidor" lia o catálogo/chamados (transparência operacional). Aqui NÃO — documento
-- de visitante é dado pessoal (LGPD, minimização + acesso restrito), então leitura e
-- escrita ficam travadas a INSPETOR/GESTAO/SECRETARIA só. PROFESSOR, COORDENACAO,
-- NUTRICAO e BIBLIOTECA não têm nenhum acesso a estas duas tabelas.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS visitantes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             TEXT NOT NULL,
  documento        TEXT NOT NULL,
  motivo           TEXT,
  pessoa_a_visitar TEXT,
  entrada_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  saida_em         TIMESTAMPTZ,
  registrado_por   UUID REFERENCES usuarios(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitantes_entrada ON visitantes (entrada_em);

CREATE TABLE IF NOT EXISTS registros_portaria (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  criado_por  UUID REFERENCES usuarios(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE visitantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitantes FORCE ROW LEVEL SECURITY;
ALTER TABLE registros_portaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_portaria FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visitantes_select" ON visitantes;
CREATE POLICY "visitantes_select" ON visitantes FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('INSPETOR') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP POLICY IF EXISTS "visitantes_insert" ON visitantes;
CREATE POLICY "visitantes_insert" ON visitantes FOR INSERT TO authenticated
  WITH CHECK (
    registrado_por = auth.uid() AND
    (public.usuario_tem_papel('INSPETOR') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  );

-- UPDATE (registrar saída, corrigir motivo etc.) — mesmo conjunto de papéis; não
-- precisa ser só quem registrou a entrada (troca de turno na portaria é normal).
DROP POLICY IF EXISTS "visitantes_update" ON visitantes;
CREATE POLICY "visitantes_update" ON visitantes FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('INSPETOR') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('INSPETOR') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP POLICY IF EXISTS "registros_portaria_select" ON registros_portaria;
CREATE POLICY "registros_portaria_select" ON registros_portaria FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('INSPETOR') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP POLICY IF EXISTS "registros_portaria_insert" ON registros_portaria;
CREATE POLICY "registros_portaria_insert" ON registros_portaria FOR INSERT TO authenticated
  WITH CHECK (
    criado_por = auth.uid() AND
    (public.usuario_tem_papel('INSPETOR') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  );

DROP TRIGGER IF EXISTS trg_auditoria_visitantes ON visitantes;
CREATE TRIGGER trg_auditoria_visitantes
  AFTER INSERT OR UPDATE OR DELETE ON visitantes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_registros_portaria ON registros_portaria;
CREATE TRIGGER trg_auditoria_registros_portaria
  AFTER INSERT OR UPDATE OR DELETE ON registros_portaria
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- Estende rpc_indicadores_gestao_escolar (mesma função, GESTAO-only) com um indicador
-- de portaria: visitantes que ainda estão na escola agora (entrada sem saída
-- registrada). Não expõe nome/documento no indicador — só a contagem.
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

    'financeiro', jsonb_build_object('sem_dados', true, 'motivo', 'sub-módulo financeiro (PDDE/APM) ainda não existe'),

    'gerado_em', now()

  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;
