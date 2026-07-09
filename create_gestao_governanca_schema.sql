-- ====================================================================================
-- GESTÃO ESCOLAR — Governança Colegiada + Comunicação Institucional (Etapa 1):
-- modelo + RLS + reaproveitamento dos motores de atas (Fase 5a) e de avisos/push já
-- existentes. Nada aqui recria numeração de documento nem pipeline de notificação.
--
-- Achados da auditoria antes de desenhar:
--   1) atas_alunos.aluno_id é NOT NULL — estruturalmente é ata de reunião SOBRE um
--      aluno, não serve para ata de reunião de colegiado. O que É 100% reaproveitado é
--      fn_proximo_numero_documento (já genérica por tipo+ano) e o padrão atômico da
--      RPC (numerar + inserir + auditoria EXPORT) — replicado em
--      rpc_emitir_ata_colegiado, gravando em atas_colegiado (nova), com
--      tipo='ATA_COLEGIADO' em contadores_documentos (série própria, não colide com
--      a numeração de ATA de aluno).
--   2) `avisos` (Biblioteca) é exclusivo de aluno — não serve como registro
--      institucional para segmento/turma/órgão. O que É reaproveitado é a ENTREGA:
--      pushService.sendPushToUsers() → Edge Function send-push-notification (já usada
--      por Biblioteca/Agendamento/Ocorrências, não é mais "só da Biblioteca" na
--      prática). `comunicados` é o registro novo; a Etapa 4 resolve destinatários e
--      chama essa mesma função de envio.
--   3) Já existe `calendario_eventos` (usado na landing pública) — será reaproveitado
--      na Etapa 4 em vez de criar eventos_institucionais. É pública (leitura anon) e
--      tem escrita liberada pra qualquer autenticado — não mexido aqui (fora do
--      escopo deste módulo), só registrado como achado.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. orgaos_colegiados — Colegiado Escolar, APM (UEx: cnpj/estatuto), Grêmio.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orgaos_colegiados (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           TEXT NOT NULL CHECK (tipo IN ('COLEGIADO_ESCOLAR', 'APM', 'GREMIO')),
  nome           TEXT NOT NULL,
  mandato_inicio DATE,
  mandato_fim    DATE,
  cnpj           TEXT,
  estatuto_doc_path TEXT,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orgaos_colegiados ENABLE ROW LEVEL SECURITY;

-- "Membros veem o próprio órgão" — sem esta policy, um membro não-GESTAO não
-- enxergaria nem o próprio órgão (só a policy write_gestao existia; achado ao
-- verificar ao vivo, corrigido antes de ir pras telas).
CREATE POLICY "orgaos_colegiados_select_membro" ON orgaos_colegiados FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR EXISTS (
      SELECT 1 FROM membros_colegiado mc
      JOIN usuarios u ON u.pessoa_id = mc.pessoa_id
      WHERE mc.orgao_id = orgaos_colegiados.id AND u.id = auth.uid()
    )
  );

CREATE POLICY "orgaos_colegiados_write_gestao" ON orgaos_colegiados FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER trg_auditoria_orgaos_colegiados
  AFTER INSERT OR UPDATE OR DELETE ON orgaos_colegiados
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. membros_colegiado — LGPD: só pessoa_id (sem duplicar dado pessoal); inclui pais
--    e alunos (menores) — minimização estrutural, nada além do necessário aqui.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS membros_colegiado (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id            UUID NOT NULL REFERENCES orgaos_colegiados(id),
  pessoa_id           UUID NOT NULL REFERENCES pessoas(id),
  segmento            TEXT NOT NULL CHECK (segmento IN ('DOCENTE', 'ESPECIALISTA', 'FUNCIONARIO', 'PAIS', 'ALUNO')),
  funcao              TEXT NOT NULL CHECK (funcao IN ('PRESIDENTE', 'SECRETARIO', 'CONSELHEIRO', 'DIRETORIA', 'CONSELHO_FISCAL')),
  titular_ou_suplente TEXT NOT NULL CHECK (titular_ou_suplente IN ('TITULAR', 'SUPLENTE')),
  mandato_inicio      DATE NOT NULL,
  mandato_fim         DATE NOT NULL,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membros_colegiado_orgao ON membros_colegiado (orgao_id);
CREATE INDEX IF NOT EXISTS idx_membros_colegiado_pessoa ON membros_colegiado (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_membros_colegiado_mandato_fim ON membros_colegiado (mandato_fim);

ALTER TABLE membros_colegiado ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_colegiado FORCE ROW LEVEL SECURITY;

CREATE POLICY "membros_colegiado_select_proprio" ON membros_colegiado FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.pessoa_id = membros_colegiado.pessoa_id)
  );

CREATE POLICY "membros_colegiado_write_gestao" ON membros_colegiado FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER trg_auditoria_membros_colegiado
  AFTER INSERT OR UPDATE OR DELETE ON membros_colegiado
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 3. reunioes_colegiado — ata_id adicionado depois (item 6), FK circular com
--    atas_colegiado resolvida via ALTER TABLE.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reunioes_colegiado (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id   UUID NOT NULL REFERENCES orgaos_colegiados(id),
  tipo       TEXT NOT NULL CHECK (tipo IN ('ORDINARIA', 'EXTRAORDINARIA', 'ASSEMBLEIA')),
  data       DATE NOT NULL,
  pauta      TEXT,
  status     TEXT NOT NULL DEFAULT 'AGENDADA' CHECK (status IN ('AGENDADA', 'REALIZADA', 'ATA_EMITIDA')),
  criado_por UUID NOT NULL REFERENCES usuarios(id),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reunioes_colegiado_orgao ON reunioes_colegiado (orgao_id);

ALTER TABLE reunioes_colegiado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reunioes_colegiado_select_membro" ON reunioes_colegiado FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR EXISTS (
      SELECT 1 FROM membros_colegiado mc
      JOIN usuarios u ON u.pessoa_id = mc.pessoa_id
      WHERE mc.orgao_id = reunioes_colegiado.orgao_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "reunioes_colegiado_write_gestao" ON reunioes_colegiado FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER trg_auditoria_reunioes_colegiado
  AFTER INSERT OR UPDATE OR DELETE ON reunioes_colegiado
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 4. reuniao_presenca — membro vê a lista de presença das reuniões do seu órgão.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reuniao_presenca (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id UUID NOT NULL REFERENCES reunioes_colegiado(id),
  membro_id  UUID NOT NULL REFERENCES membros_colegiado(id),
  presente   BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (reuniao_id, membro_id)
);

ALTER TABLE reuniao_presenca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reuniao_presenca_select_membro" ON reuniao_presenca FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR EXISTS (
      SELECT 1 FROM reunioes_colegiado r
      JOIN membros_colegiado mc ON mc.orgao_id = r.orgao_id
      JOIN usuarios u ON u.pessoa_id = mc.pessoa_id
      WHERE r.id = reuniao_presenca.reuniao_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "reuniao_presenca_write_gestao" ON reuniao_presenca FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER trg_auditoria_reuniao_presenca
  AFTER INSERT OR UPDATE OR DELETE ON reuniao_presenca
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 5. deliberacoes
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliberacoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id UUID NOT NULL REFERENCES reunioes_colegiado(id),
  descricao  TEXT NOT NULL,
  resultado  TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliberacoes_reuniao ON deliberacoes (reuniao_id);

ALTER TABLE deliberacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliberacoes_select_membro" ON deliberacoes FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR EXISTS (
      SELECT 1 FROM reunioes_colegiado r
      JOIN membros_colegiado mc ON mc.orgao_id = r.orgao_id
      JOIN usuarios u ON u.pessoa_id = mc.pessoa_id
      WHERE r.id = deliberacoes.reuniao_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "deliberacoes_write_gestao" ON deliberacoes FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER trg_auditoria_deliberacoes
  AFTER INSERT OR UPDATE OR DELETE ON deliberacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 6. atas_colegiado — mesmo padrão de atas_alunos (numeração por ano, sem policy de
--    INSERT: só a RPC do item 7 cria uma ata nova).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atas_colegiado (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id        UUID NOT NULL UNIQUE REFERENCES reunioes_colegiado(id),
  orgao_id          UUID NOT NULL REFERENCES orgaos_colegiados(id),
  titulo            TEXT NOT NULL,
  conteudo_gerado   TEXT NOT NULL,
  numero_sequencial INTEGER NOT NULL,
  ano_letivo        INTEGER NOT NULL,
  created_by        UUID NOT NULL REFERENCES usuarios(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ano_letivo, numero_sequencial)
);

ALTER TABLE reunioes_colegiado ADD COLUMN IF NOT EXISTS ata_id UUID REFERENCES atas_colegiado(id);

ALTER TABLE atas_colegiado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atas_colegiado_select_membro" ON atas_colegiado FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR EXISTS (
      SELECT 1 FROM membros_colegiado mc
      JOIN usuarios u ON u.pessoa_id = mc.pessoa_id
      WHERE mc.orgao_id = atas_colegiado.orgao_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "atas_colegiado_update_gestao" ON atas_colegiado FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

CREATE POLICY "atas_colegiado_delete_gestao" ON atas_colegiado FOR DELETE TO authenticated
  USING (public.usuario_tem_papel('GESTAO'));

CREATE TRIGGER trg_auditoria_atas_colegiado
  AFTER INSERT OR UPDATE OR DELETE ON atas_colegiado
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 7. rpc_emitir_ata_colegiado — mesmo motor de rpc_emitir_ata (Fase 5a): reaproveita
--    fn_proximo_numero_documento, só que com tipo='ATA_COLEGIADO' (série própria,
--    não colide com a numeração de ATA de aluno) e grava em atas_colegiado.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_emitir_ata_colegiado(
  p_reuniao_id UUID,
  p_titulo TEXT,
  p_conteudo_gerado TEXT,
  p_ano_letivo INTEGER
)
RETURNS atas_colegiado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INTEGER;
  v_row atas_colegiado;
  v_orgao_id UUID;
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Sem permissão para emitir atas de colegiado.' USING ERRCODE = '42501';
  END IF;

  SELECT orgao_id INTO v_orgao_id FROM reunioes_colegiado WHERE id = p_reuniao_id;
  IF v_orgao_id IS NULL THEN
    RAISE EXCEPTION 'Reunião não encontrada.';
  END IF;

  v_numero := public.fn_proximo_numero_documento('ATA_COLEGIADO', p_ano_letivo);

  INSERT INTO atas_colegiado (reuniao_id, orgao_id, titulo, conteudo_gerado, numero_sequencial, ano_letivo, created_by)
  VALUES (p_reuniao_id, v_orgao_id, p_titulo, p_conteudo_gerado, v_numero, p_ano_letivo, auth.uid())
  RETURNING * INTO v_row;

  UPDATE reunioes_colegiado SET status = 'ATA_EMITIDA', ata_id = v_row.id WHERE id = p_reuniao_id;

  INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, pessoa_afetada_id, campos_alterados)
  VALUES (auth.uid(), 'EXPORT', 'atas_colegiado', v_row.id, NULL, ARRAY['emissao_ata_colegiado']);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_emitir_ata_colegiado(UUID, TEXT, TEXT, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_emitir_ata_colegiado(UUID, TEXT, TEXT, INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 8. comunicados — registro institucional novo (entrega reaproveita
--    pushService.sendPushToUsers na Etapa 4, sem segundo pipeline de notificação).
--    Publicado é visível a qualquer autenticado (comunicado institucional não é dado
--    sensível); rascunho só quem escreve.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comunicados (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT NOT NULL CHECK (tipo IN ('COMUNICADO', 'CONVOCACAO', 'EVENTO')),
  titulo        TEXT NOT NULL,
  corpo         TEXT,
  destino       TEXT NOT NULL CHECK (destino IN ('TODOS', 'SEGMENTO', 'TURMA', 'ORGAO')),
  destino_ref   TEXT,
  autor_id      UUID NOT NULL REFERENCES usuarios(id),
  publicado_em  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'PUBLICADO')),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (destino = 'TODOS' OR destino_ref IS NOT NULL)
);

ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comunicados_select" ON comunicados FOR SELECT TO authenticated
  USING (
    status = 'PUBLICADO'
    OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('SECRETARIA')
  );

CREATE POLICY "comunicados_write" ON comunicados FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('SECRETARIA'));

CREATE TRIGGER trg_auditoria_comunicados
  AFTER INSERT OR UPDATE OR DELETE ON comunicados
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 9. Bucket de Storage `governanca-documentos` — PRIVADO. Estatuto da APM é documento
--    legal oficial; GESTAO-only (mais restrito que outros buckets deste projeto, que
--    em geral liberam pra 2 papéis — aqui não há um segundo papel operacional
--    envolvido na guarda deste documento específico).
-- ------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('governanca-documentos', 'governanca-documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "governanca_documentos_select" ON storage.objects;
CREATE POLICY "governanca_documentos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'governanca-documentos' AND public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "governanca_documentos_insert" ON storage.objects;
CREATE POLICY "governanca_documentos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'governanca-documentos' AND public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "governanca_documentos_update" ON storage.objects;
CREATE POLICY "governanca_documentos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'governanca-documentos' AND public.usuario_tem_papel('GESTAO'))
  WITH CHECK (bucket_id = 'governanca-documentos' AND public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "governanca_documentos_delete" ON storage.objects;
CREATE POLICY "governanca_documentos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'governanca-documentos' AND public.usuario_tem_papel('GESTAO'));
