-- ====================================================================================
-- GESTÃO ESCOLAR — RH operacional interno (Etapa 1): modelo + RLS + moldura
-- "complementar à SUGESP/SED, não concede licença nem formaliza substituição" +
-- Storage do atestado. Reaproveita professores como o "servidor" da Fundação.
--
-- Achado na auditoria antes de desenhar: `atestados_servidores` já existe, tem 1
-- registro real (licença-maternidade em andamento) e já está ligada a
-- `alocacoes_v2` via espelhamento de turmas (AtestadoModal.tsx) — é, na prática, a
-- tabela de "ausências" da spec, só que mais poderosa (o espelhamento de fato
-- realoca turmas, algo que a nova tabela `substituicoes` abaixo NÃO faz de propósito).
-- Sua RLS hoje é `USING (true)` — QUALQUER autenticado lê o motivo de uma licença
-- médica. Corrigido aqui. Mantida com o nome/mecanismo originais para não quebrar
-- AtestadoModal.tsx/ProfessorManager.tsx/AllocationManager.tsx/Dashboard.tsx.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Retrofit de atestados_servidores — campos da moldura oficial + RLS + auditoria.
-- ------------------------------------------------------------------------------------
ALTER TABLE atestados_servidores
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'ATESTADO' CHECK (tipo IN ('ATESTADO', 'LICENCA', 'FERIAS', 'FALTA', 'OUTRO')),
  ADD COLUMN IF NOT EXISTS status_oficial TEXT NOT NULL DEFAULT 'INTERNO' CHECK (status_oficial IN ('INTERNO', 'ENVIADO_SED', 'DEFERIDO', 'PUBLICADO_DO')),
  ADD COLUMN IF NOT EXISTS processo_sed_ref TEXT,
  ADD COLUMN IF NOT EXISTS documento_path TEXT;

DROP POLICY IF EXISTS "Acesso publico atestados" ON atestados_servidores;

DROP POLICY IF EXISTS "atestados_servidores_select" ON atestados_servidores;
CREATE POLICY "atestados_servidores_select" ON atestados_servidores FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')
    OR EXISTS (SELECT 1 FROM professores p WHERE p.id = atestados_servidores.professor_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "atestados_servidores_write" ON atestados_servidores;
CREATE POLICY "atestados_servidores_write" ON atestados_servidores FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_atestados_servidores ON atestados_servidores;
CREATE TRIGGER trg_auditoria_atestados_servidores
  AFTER INSERT OR UPDATE OR DELETE ON atestados_servidores
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. jornada_servidor — escala/horário. Só GESTAO/SECRETARIA (não é do próprio
--    servidor consultar aqui, por enquanto — RBAC da spec só lista frequência e
--    ausências como autoconsulta).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jornada_servidor (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor_id    UUID NOT NULL REFERENCES professores(id),
  turno          TEXT NOT NULL CHECK (turno IN ('Matutino', 'Vespertino', 'Noturno', 'Integral')),
  dias_semana    SMALLINT[] NOT NULL DEFAULT '{}',
  hora_inicio    TIME NOT NULL,
  hora_fim       TIME NOT NULL,
  vigencia_inicio DATE NOT NULL DEFAULT current_date,
  vigencia_fim   DATE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jornada_servidor_servidor ON jornada_servidor (servidor_id);

ALTER TABLE jornada_servidor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jornada_servidor_rw_gestao_secretaria" ON jornada_servidor;
CREATE POLICY "jornada_servidor_rw_gestao_secretaria" ON jornada_servidor FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_jornada_servidor ON jornada_servidor;
CREATE TRIGGER trg_auditoria_jornada_servidor
  AFTER INSERT OR UPDATE OR DELETE ON jornada_servidor
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 3. terceirizados — cadastro. Não têm login no sistema (spec não pede), então sem
--    necessidade de autoconsulta.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terceirizados (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      TEXT NOT NULL,
  empresa   TEXT,
  funcao    TEXT NOT NULL CHECK (funcao IN ('LIMPEZA', 'MERENDA', 'VIGILANCIA', 'OUTRO')),
  contato   TEXT,
  ativo     BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE terceirizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terceirizados_rw_gestao_secretaria" ON terceirizados;
CREATE POLICY "terceirizados_rw_gestao_secretaria" ON terceirizados FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_terceirizados ON terceirizados;
CREATE TRIGGER trg_auditoria_terceirizados
  AFTER INSERT OR UPDATE OR DELETE ON terceirizados
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 4. frequencia_servidor — ponto interno diário. `vinculo` + o CHECK abaixo garantem,
--    no banco, que um registro é OU de servidor OU de terceirizado, nunca os dois —
--    resolve estruturalmente o critério "terceirizado não confundido com servidor".
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS frequencia_servidor (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo        TEXT NOT NULL CHECK (vinculo IN ('SERVIDOR', 'TERCEIRIZADO')),
  servidor_id    UUID REFERENCES professores(id),
  terceirizado_id UUID REFERENCES terceirizados(id),
  data           DATE NOT NULL DEFAULT current_date,
  status         TEXT NOT NULL CHECK (status IN ('PRESENTE', 'AUSENTE', 'ATRASO', 'ABONADA', 'AFASTADO')),
  entrada        TIME,
  saida          TIME,
  justificativa  TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (vinculo = 'SERVIDOR' AND servidor_id IS NOT NULL AND terceirizado_id IS NULL) OR
    (vinculo = 'TERCEIRIZADO' AND terceirizado_id IS NOT NULL AND servidor_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_frequencia_servidor_dia ON frequencia_servidor (servidor_id, data) WHERE vinculo = 'SERVIDOR';
CREATE UNIQUE INDEX IF NOT EXISTS uq_frequencia_terceirizado_dia ON frequencia_servidor (terceirizado_id, data) WHERE vinculo = 'TERCEIRIZADO';
CREATE INDEX IF NOT EXISTS idx_frequencia_servidor_data ON frequencia_servidor (data);

ALTER TABLE frequencia_servidor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frequencia_servidor_select" ON frequencia_servidor;
CREATE POLICY "frequencia_servidor_select" ON frequencia_servidor FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')
    OR EXISTS (SELECT 1 FROM professores p WHERE p.id = frequencia_servidor.servidor_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "frequencia_servidor_write" ON frequencia_servidor;
CREATE POLICY "frequencia_servidor_write" ON frequencia_servidor FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_frequencia_servidor ON frequencia_servidor;
CREATE TRIGGER trg_auditoria_frequencia_servidor
  AFTER INSERT OR UPDATE OR DELETE ON frequencia_servidor
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 5. substituicoes — arranjo INFORMAL de cobertura diária, deliberadamente separado
--    do espelhamento de atestados_servidores/alocacoes_v2 (que de fato realoca
--    turmas). Aqui é só registro/aviso: status nunca sai de ARRANJO_INTERNO
--    automaticamente, e FORMALIZADA_SED é apenas um rótulo manual — não confere
--    nenhum acesso real (diferente do espelhamento).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS substituicoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servidor_ausente_id UUID NOT NULL REFERENCES professores(id),
  substituto_id       UUID REFERENCES professores(id),
  turma_id            UUID REFERENCES turmas(id),
  aula_ref            TEXT,
  data                DATE NOT NULL DEFAULT current_date,
  status              TEXT NOT NULL DEFAULT 'ARRANJO_INTERNO' CHECK (status IN ('ARRANJO_INTERNO', 'FORMALIZADA_SED')),
  observacoes         TEXT,
  registrado_por      UUID NOT NULL REFERENCES usuarios(id),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (turma_id IS NOT NULL OR aula_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_substituicoes_data ON substituicoes (data);

ALTER TABLE substituicoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "substituicoes_rw_gestao_secretaria" ON substituicoes;
CREATE POLICY "substituicoes_rw_gestao_secretaria" ON substituicoes FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_substituicoes ON substituicoes;
CREATE TRIGGER trg_auditoria_substituicoes
  AFTER INSERT OR UPDATE OR DELETE ON substituicoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 6. Bucket de Storage `rh-documentos` — PRIVADO. Guarda documento_path de
--    atestados_servidores. Restrito a GESTAO/SECRETARIA (nem o próprio servidor baixa
--    o arquivo bruto por aqui — mesma decisão conservadora do laudo de necessidades
--    especiais da Cozinha; o registro na tabela já deixa ele ver que está afastado).
-- ------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('rh-documentos', 'rh-documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "rh_documentos_select" ON storage.objects;
CREATE POLICY "rh_documentos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rh-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')));

DROP POLICY IF EXISTS "rh_documentos_insert" ON storage.objects;
CREATE POLICY "rh_documentos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rh-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')));

DROP POLICY IF EXISTS "rh_documentos_update" ON storage.objects;
CREATE POLICY "rh_documentos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'rh-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')))
  WITH CHECK (bucket_id = 'rh-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')));

DROP POLICY IF EXISTS "rh_documentos_delete" ON storage.objects;
CREATE POLICY "rh_documentos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rh-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')));
