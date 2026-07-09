-- ====================================================================================
-- MÓDULO SECRETARIA — Etapa 1: tabelas, numeração atômica, RLS e auditoria.
-- Execute no Painel do Supabase > SQL Editor, depois de todos os scripts create_fundacao_*.
-- Serviços e telas vêm numa entrega seguinte, depois desta revisão.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. series_referencia — tabela de referência (dropdown), editável só por GESTAO.
--    `codigo` usa uma convenção legível (EF01..EF09, EM01..EM03), NÃO o código oficial
--    TP_ETAPA_ENSINO do Censo/INEP — não vou inventar esses números sem confirmar a
--    tabela oficial vigente; o de-para fica para quando a exportação for implementada.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series_referencia (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  TEXT NOT NULL UNIQUE,
  nome    TEXT NOT NULL,
  ordem   INTEGER NOT NULL,
  ativo   BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE series_referencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "series_referencia_select_autenticado" ON series_referencia;
CREATE POLICY "series_referencia_select_autenticado" ON series_referencia
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "series_referencia_write_gestao" ON series_referencia;
CREATE POLICY "series_referencia_write_gestao" ON series_referencia
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO'));

INSERT INTO series_referencia (codigo, nome, ordem, ativo) VALUES
  ('EF01', '1º Ano - Ensino Fundamental', 1, true),
  ('EF02', '2º Ano - Ensino Fundamental', 2, true),
  ('EF03', '3º Ano - Ensino Fundamental', 3, true),
  ('EF04', '4º Ano - Ensino Fundamental', 4, true),
  ('EF05', '5º Ano - Ensino Fundamental', 5, true),
  ('EF06', '6º Ano - Ensino Fundamental', 6, true),
  ('EF07', '7º Ano - Ensino Fundamental', 7, true),
  ('EF08', '8º Ano - Ensino Fundamental', 8, true),
  ('EF09', '9º Ano - Ensino Fundamental', 9, true),
  ('EM01', '1ª Série - Ensino Médio', 10, true),
  ('EM02', '2ª Série - Ensino Médio', 11, true),
  ('EM03', '3ª Série - Ensino Médio', 12, true)
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------------------------------
-- 2. matriculas — ficha de matrícula formal por ANO LETIVO, ligada à Pessoa (estável),
--    não ao registro operacional de `alunos` (que muda de id no Remanejamento).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matriculas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id             UUID NOT NULL REFERENCES pessoas(id),
  ano_letivo            INTEGER NOT NULL,
  serie_id              UUID NOT NULL REFERENCES series_referencia(id),
  turno                 TEXT NOT NULL CHECK (turno IN ('Matutino', 'Vespertino', 'Noturno', 'Integral')),
  data_matricula         DATE NOT NULL DEFAULT current_date,
  escola_procedencia    TEXT,
  endereco_logradouro   TEXT,
  endereco_numero       TEXT,
  endereco_bairro       TEXT,
  endereco_cidade       TEXT,
  endereco_uf           TEXT,
  endereco_cep          TEXT,
  status_matricula      TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status_matricula IN ('ATIVA', 'ENCERRADA', 'TRANSFERIDA')),
  motivo_saida          TEXT,
  data_saida            DATE,
  observacoes           TEXT,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pessoa_id, ano_letivo)
);

CREATE INDEX IF NOT EXISTS idx_matriculas_pessoa ON matriculas (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_ano ON matriculas (ano_letivo);

ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matriculas_rw_gestao_secretaria" ON matriculas;
CREATE POLICY "matriculas_rw_gestao_secretaria" ON matriculas
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

-- ------------------------------------------------------------------------------------
-- 2.1 Exigência de consentimento — "a tabela não pode nascer vazia": nenhuma matrícula
--     é criada sem já existir um consentimento CADASTRO aceito para aquela pessoa.
--     Vale para todo aluno (decisão confirmada), sem distinção de idade — adulto
--     registra o próprio aceite (aceito_por_pessoa_id = a própria pessoa).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_matricula_exige_consentimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM consentimentos
    WHERE pessoa_id = NEW.pessoa_id AND tipo = 'CADASTRO' AND aceito = true
  ) THEN
    RAISE EXCEPTION 'Matrícula requer um consentimento de CADASTRO aceito registrado para esta pessoa antes de prosseguir.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matricula_exige_consentimento ON matriculas;
CREATE TRIGGER trg_matricula_exige_consentimento
  BEFORE INSERT ON matriculas
  FOR EACH ROW EXECUTE FUNCTION public.fn_matricula_exige_consentimento();

DROP TRIGGER IF EXISTS trg_auditoria_matriculas ON matriculas;
CREATE TRIGGER trg_auditoria_matriculas
  AFTER INSERT OR UPDATE OR DELETE ON matriculas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 3. Divergência matrícula × status operacional (StudentManager permanece intacto).
--    Regra: TRANSFERIDA/ENCERRADA na secretaria mas ainda "ativo" na operação, OU
--    ATIVA na secretaria mas já "saiu" na operação. Regra é um ponto de partida —
--    ajustável depois sem migração (é só lógica dentro da função).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_divergencias_matricula(p_ano_letivo INTEGER DEFAULT NULL)
RETURNS TABLE (
  pessoa_id UUID,
  pessoa_nome TEXT,
  aluno_id UUID,
  status_operacional TEXT,
  status_matricula TEXT,
  ano_letivo INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano INTEGER := COALESCE(p_ano_letivo, extract(year FROM current_date)::int);
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para consultar divergências de matrícula.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT pe.id, pe.nome, a.id, a.status, m.status_matricula, m.ano_letivo
  FROM matriculas m
  JOIN pessoas pe ON pe.id = m.pessoa_id
  JOIN alunos a ON a.pessoa_id = m.pessoa_id
  WHERE m.ano_letivo = v_ano
    AND (
      (m.status_matricula IN ('TRANSFERIDA', 'ENCERRADA') AND a.status NOT IN ('Transferido', 'Cancelada', 'Remanejado'))
      OR
      (m.status_matricula = 'ATIVA' AND a.status IN ('Transferido', 'Cancelada'))
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_divergencias_matricula(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_divergencias_matricula(INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. documentos_pessoa — repositório de documentos digitalizados (genérico por Pessoa,
--    reaproveitável por Servidor/Responsável no futuro, não só Aluno).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_pessoa (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id     UUID NOT NULL REFERENCES pessoas(id),
  tipo          TEXT NOT NULL CHECK (tipo IN ('RG_CERTIDAO', 'CPF', 'COMPROVANTE_RESIDENCIA', 'HISTORICO_ESCOLAR', 'OUTRO')),
  nome_arquivo  TEXT NOT NULL,
  arquivo_path  TEXT NOT NULL,
  enviado_por   UUID NOT NULL REFERENCES usuarios(id),
  enviado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacoes   TEXT
);

CREATE INDEX IF NOT EXISTS idx_documentos_pessoa_pessoa ON documentos_pessoa (pessoa_id);

ALTER TABLE documentos_pessoa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_pessoa_rw_gestao_secretaria" ON documentos_pessoa;
CREATE POLICY "documentos_pessoa_rw_gestao_secretaria" ON documentos_pessoa
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_documentos_pessoa ON documentos_pessoa;
CREATE TRIGGER trg_auditoria_documentos_pessoa
  AFTER INSERT OR UPDATE OR DELETE ON documentos_pessoa
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 5. Bucket de Storage `documentos-pessoas` — PRIVADO (diferente de fotos-alunos).
--    Se o INSERT abaixo não funcionar no seu plano do Supabase, crie manualmente em
--    Storage > New bucket > "documentos-pessoas", desmarcando "Public bucket".
-- ------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-pessoas', 'documentos-pessoas', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage.objects: SELECT (necessário até para gerar signed URL),
-- INSERT, UPDATE e DELETE — todas restritas a GESTAO/SECRETARIA.
DROP POLICY IF EXISTS "documentos_pessoas_select" ON storage.objects;
CREATE POLICY "documentos_pessoas_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documentos-pessoas' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')));

DROP POLICY IF EXISTS "documentos_pessoas_insert" ON storage.objects;
CREATE POLICY "documentos_pessoas_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'documentos-pessoas' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')));

DROP POLICY IF EXISTS "documentos_pessoas_update" ON storage.objects;
CREATE POLICY "documentos_pessoas_update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'documentos-pessoas' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')))
  WITH CHECK (bucket_id = 'documentos-pessoas' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')));

DROP POLICY IF EXISTS "documentos_pessoas_delete" ON storage.objects;
CREATE POLICY "documentos_pessoas_delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'documentos-pessoas' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')));

-- NOTA para a etapa de serviços (próxima entrega): toda geração de signed URL para
-- leitura de um documento sensível deve chamar log_acesso('documentos_pessoa',
-- documento_id, pessoa_id, 'READ') logo em seguida (best-effort, mesma limitação já
-- documentada em create_fundacao_auditoria.sql).

-- ------------------------------------------------------------------------------------
-- 6. Numeração atômica — usada tanto por documentos_emitidos quanto por protocolos.
--    O UPSERT abaixo é atômico por natureza do Postgres: o índice único (tipo, ano)
--    serializa chamadas concorrentes (a segunda espera o lock da primeira liberar),
--    então nunca duas chamadas simultâneas recebem o mesmo número.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contadores_documentos (
  tipo          TEXT NOT NULL,
  ano           INTEGER NOT NULL,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tipo, ano)
);

ALTER TABLE contadores_documentos ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma policy: ninguém lê/escreve direto nesta tabela via API. O único acesso
-- é via fn_proximo_numero_documento() (SECURITY DEFINER, bypassa RLS ao executar).

CREATE OR REPLACE FUNCTION public.fn_proximo_numero_documento(p_tipo TEXT, p_ano INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO contadores_documentos (tipo, ano, ultimo_numero)
  VALUES (p_tipo, p_ano, 1)
  ON CONFLICT (tipo, ano) DO UPDATE SET ultimo_numero = contadores_documentos.ultimo_numero + 1
  RETURNING ultimo_numero;
$$;

REVOKE ALL ON FUNCTION public.fn_proximo_numero_documento(TEXT, INTEGER) FROM public;
-- Só GESTAO/SECRETARIA (indiretamente, via as RPCs de emissão/protocolo que ainda vamos
-- criar na próxima entrega) chamam esta função — por isso não concedo EXECUTE direto
-- a "authenticated" aqui. As RPCs futuras (SECURITY DEFINER) chamam esta função
-- internamente, e ELAS SIM terão GRANT EXECUTE para authenticated, com a checagem de
-- papel feita ali dentro — não gero número no cliente, conforme pedido.

-- ------------------------------------------------------------------------------------
-- 7. documentos_emitidos — snapshot imutável do documento no momento da emissão.
--    dados_snapshot congela o estado para o documento nunca "mudar" depois de emitido,
--    mesmo que o cadastro da pessoa seja editado em seguida.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_emitidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL CHECK (tipo IN ('DECLARACAO_MATRICULA', 'HISTORICO_ESCOLAR', 'ATESTADO_FREQUENCIA', 'TRANSFERENCIA')),
  numero          INTEGER NOT NULL,
  ano             INTEGER NOT NULL,
  pessoa_id       UUID NOT NULL REFERENCES pessoas(id),
  matricula_id    UUID REFERENCES matriculas(id),
  emitido_por     UUID NOT NULL REFERENCES usuarios(id),
  emitido_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  arquivo_path    TEXT,
  dados_snapshot  JSONB NOT NULL,
  UNIQUE (tipo, ano, numero)
);

CREATE INDEX IF NOT EXISTS idx_documentos_emitidos_pessoa ON documentos_emitidos (pessoa_id);

ALTER TABLE documentos_emitidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_emitidos_rw_gestao_secretaria" ON documentos_emitidos;
CREATE POLICY "documentos_emitidos_rw_gestao_secretaria" ON documentos_emitidos
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_documentos_emitidos ON documentos_emitidos;
CREATE TRIGGER trg_auditoria_documentos_emitidos
  AFTER INSERT OR UPDATE OR DELETE ON documentos_emitidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- NOTA para a próxima entrega: o trigger acima grava a CRIAÇÃO do registro de emissão
-- como 'CREATE' (é o que de fato aconteceu na tabela). Além disso, a RPC/Edge Function
-- de emissão (a ser construída) deve INSERIR TAMBÉM um evento 'EXPORT' em auditoria
-- (mesmo padrão de rpc_exportar_pessoa em create_fundacao_lgpd.sql) — emitir um
-- documento com dados consolidados da pessoa é, em si, uma exportação de dado pessoal.

-- ------------------------------------------------------------------------------------
-- 8. protocolos — numeração atômica por ano via fn_proximo_numero_documento('PROTOCOLO', ano).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS protocolos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          INTEGER NOT NULL,
  ano             INTEGER NOT NULL,
  tipo            TEXT NOT NULL,
  assunto         TEXT NOT NULL,
  interessado     TEXT NOT NULL,
  pessoa_id       UUID REFERENCES pessoas(id),
  recebido_por    UUID NOT NULL REFERENCES usuarios(id),
  recebido_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'ARQUIVADO')),
  prazo           DATE,
  encaminhamento  TEXT,
  observacoes     TEXT,
  UNIQUE (ano, numero)
);

CREATE INDEX IF NOT EXISTS idx_protocolos_pessoa ON protocolos (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_status ON protocolos (status);

ALTER TABLE protocolos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "protocolos_rw_gestao_secretaria" ON protocolos;
CREATE POLICY "protocolos_rw_gestao_secretaria" ON protocolos
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_protocolos ON protocolos;
CREATE TRIGGER trg_auditoria_protocolos
  AFTER INSERT OR UPDATE OR DELETE ON protocolos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- Anexos de protocolo — mesmo "formato" de documentos_pessoa, mas o protocolo pode não
-- ter pessoa_id (ex.: ofício administrativo geral), então é uma tabela própria, não uma
-- reutilização direta de documentos_pessoa. Usa o MESMO bucket documentos-pessoas
-- (path sugerido: protocolos/{protocolo_id}/arquivo), as mesmas policies já cobrem.
CREATE TABLE IF NOT EXISTS anexos_protocolo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id  UUID NOT NULL REFERENCES protocolos(id) ON DELETE CASCADE,
  nome_arquivo  TEXT NOT NULL,
  arquivo_path  TEXT NOT NULL,
  enviado_por   UUID NOT NULL REFERENCES usuarios(id),
  enviado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anexos_protocolo_protocolo ON anexos_protocolo (protocolo_id);

ALTER TABLE anexos_protocolo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anexos_protocolo_rw_gestao_secretaria" ON anexos_protocolo;
CREATE POLICY "anexos_protocolo_rw_gestao_secretaria" ON anexos_protocolo
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_anexos_protocolo ON anexos_protocolo;
CREATE TRIGGER trg_auditoria_anexos_protocolo
  AFTER INSERT OR UPDATE OR DELETE ON anexos_protocolo
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
