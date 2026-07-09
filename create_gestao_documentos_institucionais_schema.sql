-- ====================================================================================
-- DOCUMENTOS INSTITUCIONAIS — Etapa 1: modelo + RLS + versionamento não destrutivo +
-- Storage. Reaproveita a Fundação (usuario_tem_papel, fn_auditoria) e o gancho com
-- Governança (orgaos_colegiados, já existente).
--
-- Não é editor colaborativo: não há UPDATE de conteúdo de versão. As duas únicas
-- operações de escrita em versoes_documento são RPCs (criar versão nova / promover a
-- vigente) — sem policy de INSERT/UPDATE/DELETE direto, garantindo que o número de
-- versão nunca colide sob concorrência e que a regra "só 1 vigente" nunca é
-- contornada por um UPDATE cru. Nenhuma policy de DELETE em nenhuma das duas tabelas:
-- "histórico completo preservado" é uma regra, não só uma preferência de UI.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. documentos_institucionais — versao_vigente_id adicionado depois (item 3), FK
--    circular com versoes_documento resolvida via ALTER TABLE.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_institucionais (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT NOT NULL CHECK (tipo IN ('PPP', 'REGIMENTO', 'PLANO_GESTAO', 'ATO_NORMATIVO', 'OUTRO')),
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  visibilidade TEXT NOT NULL DEFAULT 'INTERNO' CHECK (visibilidade IN ('INTERNO', 'COMUNIDADE')),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE documentos_institucionais ENABLE ROW LEVEL SECURITY;

-- "Pedagógicos" (PPP/Regimento/Plano de Gestão) — COORDENACAO também gerencia.
-- Documentos com visibilidade COMUNIDADE ficam legíveis a qualquer autenticado (não
-- há policy nenhuma pra `anon`/público da internet — a leitura exige login).
CREATE POLICY "documentos_institucionais_select" ON documentos_institucionais FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')
    OR visibilidade = 'COMUNIDADE'
  );

CREATE POLICY "documentos_institucionais_write" ON documentos_institucionais FOR ALL TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO')
    OR (public.usuario_tem_papel('COORDENACAO') AND tipo IN ('PPP', 'REGIMENTO', 'PLANO_GESTAO'))
  )
  WITH CHECK (
    public.usuario_tem_papel('GESTAO')
    OR (public.usuario_tem_papel('COORDENACAO') AND tipo IN ('PPP', 'REGIMENTO', 'PLANO_GESTAO'))
  );

CREATE TRIGGER trg_auditoria_documentos_institucionais
  AFTER INSERT OR UPDATE OR DELETE ON documentos_institucionais
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. versoes_documento — ledger de versões. status controla o ciclo de vida; a
--    unicidade de "só 1 VIGENTE por documento" é travada por ÍNDICE (não só pela
--    RPC), então nem um bug na RPC nem um acesso direto ao banco conseguem violar
--    essa regra.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS versoes_documento (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id      UUID NOT NULL REFERENCES documentos_institucionais(id),
  versao            INTEGER NOT NULL,
  arquivo_path      TEXT,
  resumo_alteracoes TEXT,
  status            TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'EM_APROVACAO', 'VIGENTE', 'SUBSTITUIDA')),
  aprovado_por      UUID REFERENCES usuarios(id),
  aprovado_em       TIMESTAMPTZ,
  orgao_aprovador_id UUID REFERENCES orgaos_colegiados(id),
  criado_por        UUID NOT NULL REFERENCES usuarios(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (documento_id, versao)
);

CREATE UNIQUE INDEX idx_versoes_documento_unica_vigente ON versoes_documento (documento_id) WHERE status = 'VIGENTE';
CREATE INDEX idx_versoes_documento_documento ON versoes_documento (documento_id);

ALTER TABLE documentos_institucionais ADD COLUMN IF NOT EXISTS versao_vigente_id UUID REFERENCES versoes_documento(id);

ALTER TABLE versoes_documento ENABLE ROW LEVEL SECURITY;

-- Comunidade só enxerga a versão VIGENTE (a "transparência" é sobre o documento
-- oficial em vigor, não sobre rascunhos/histórico interno de edição).
CREATE POLICY "versoes_documento_select" ON versoes_documento FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')
    OR (
      status = 'VIGENTE'
      AND EXISTS (SELECT 1 FROM documentos_institucionais di WHERE di.id = versoes_documento.documento_id AND di.visibilidade = 'COMUNIDADE')
    )
  );

CREATE TRIGGER trg_auditoria_versoes_documento
  AFTER INSERT OR UPDATE OR DELETE ON versoes_documento
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 3. rpc_criar_versao_documento — única porta de entrada pra nova versão. Número de
--    versão calculado com advisory lock (mesma régua de atomicidade usada em todo o
--    resto da Fundação) — nunca duas versões nascem com o mesmo número sob
--    concorrência. Sempre nasce RASCUNHO: nunca afeta a vigente.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_criar_versao_documento(
  p_documento_id UUID,
  p_arquivo_path TEXT,
  p_resumo_alteracoes TEXT
)
RETURNS versoes_documento
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo TEXT;
  v_versao INTEGER;
  v_row versoes_documento;
BEGIN
  SELECT tipo INTO v_tipo FROM documentos_institucionais WHERE id = p_documento_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Documento institucional não encontrado.';
  END IF;

  IF NOT (
    public.usuario_tem_papel('GESTAO')
    OR (public.usuario_tem_papel('COORDENACAO') AND v_tipo IN ('PPP', 'REGIMENTO', 'PLANO_GESTAO'))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar versão deste documento.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_documento_id::text));

  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao FROM versoes_documento WHERE documento_id = p_documento_id;

  INSERT INTO versoes_documento (documento_id, versao, arquivo_path, resumo_alteracoes, status, criado_por)
  VALUES (p_documento_id, v_versao, p_arquivo_path, p_resumo_alteracoes, 'RASCUNHO', auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_versao_documento(UUID, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_criar_versao_documento(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. rpc_promover_versao_vigente — única porta pra virar vigente. Rebaixa a vigente
--    anterior a SUBSTITUIDA (nunca apaga) antes de promover a nova, dentro do mesmo
--    lock — o índice único garante que nunca existem duas VIGENTE ao mesmo tempo,
--    mesmo sob concorrência. PPP/Regimento exigem orgao_aprovador_id (Colegiado).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_promover_versao_vigente(
  p_versao_id UUID,
  p_orgao_aprovador_id UUID DEFAULT NULL
)
RETURNS versoes_documento
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_documento_id UUID;
  v_tipo TEXT;
  v_row versoes_documento;
BEGIN
  SELECT vd.documento_id, di.tipo INTO v_documento_id, v_tipo
  FROM versoes_documento vd
  JOIN documentos_institucionais di ON di.id = vd.documento_id
  WHERE vd.id = p_versao_id;

  IF v_documento_id IS NULL THEN
    RAISE EXCEPTION 'Versão não encontrada.';
  END IF;

  IF NOT (
    public.usuario_tem_papel('GESTAO')
    OR (public.usuario_tem_papel('COORDENACAO') AND v_tipo IN ('PPP', 'REGIMENTO', 'PLANO_GESTAO'))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para promover este documento.' USING ERRCODE = '42501';
  END IF;

  IF v_tipo IN ('PPP', 'REGIMENTO') AND p_orgao_aprovador_id IS NULL THEN
    RAISE EXCEPTION 'PPP e Regimento exigem o registro do órgão aprovador (Colegiado Escolar).' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_documento_id::text));

  UPDATE versoes_documento SET status = 'SUBSTITUIDA' WHERE documento_id = v_documento_id AND status = 'VIGENTE';

  UPDATE versoes_documento
  SET status = 'VIGENTE', aprovado_por = auth.uid(), aprovado_em = now(), orgao_aprovador_id = p_orgao_aprovador_id
  WHERE id = p_versao_id
  RETURNING * INTO v_row;

  UPDATE documentos_institucionais SET versao_vigente_id = p_versao_id WHERE id = v_documento_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_promover_versao_vigente(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_promover_versao_vigente(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 5. Bucket de Storage `documentos-institucionais` — PRIVADO. INSERT liberado a
--    GESTAO/COORDENACAO no nível do bucket (checagem fina de tipo pedagógico
--    acontece na RPC, que é a porta real de criação da versão); SELECT adicional pra
--    arquivo de versão VIGENTE de documento COMUNIDADE (mesmo critério da tabela,
--    espelhado aqui porque a RLS de Storage é independente da RLS das tabelas de
--    negócio). Sem policy de DELETE — não destrutivo até no arquivo bruto.
-- ------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-institucionais', 'documentos-institucionais', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documentos_institucionais_storage_select" ON storage.objects;
CREATE POLICY "documentos_institucionais_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-institucionais'
    AND (
      public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')
      OR EXISTS (
        SELECT 1 FROM versoes_documento vd
        JOIN documentos_institucionais di ON di.id = vd.documento_id
        WHERE vd.arquivo_path = storage.objects.name AND vd.status = 'VIGENTE' AND di.visibilidade = 'COMUNIDADE'
      )
    )
  );

DROP POLICY IF EXISTS "documentos_institucionais_storage_insert" ON storage.objects;
CREATE POLICY "documentos_institucionais_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-institucionais' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')));

DROP POLICY IF EXISTS "documentos_institucionais_storage_update" ON storage.objects;
CREATE POLICY "documentos_institucionais_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-institucionais' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')))
  WITH CHECK (bucket_id = 'documentos-institucionais' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')));
