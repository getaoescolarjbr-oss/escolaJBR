-- ====================================================================================
-- FUNDAÇÃO — Etapa 4: LGPD (consentimento + exportar/excluir dados de uma Pessoa)
-- Execute no Painel do Supabase > SQL Editor, depois dos scripts das Etapas 2 e 3.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Consentimentos — registro imutável (append-only). Revogar consentimento = criar
--    uma NOVA linha com aceito=false, nunca apagar/alterar a anterior (senão perdemos
--    a prova de que o aceite existiu naquela data).
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consentimentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id           UUID NOT NULL REFERENCES pessoas(id),
  tipo                TEXT NOT NULL CHECK (tipo IN ('CADASTRO', 'USO_IMAGEM', 'DADOS_SENSIVEIS')),
  aceito              BOOLEAN NOT NULL,
  aceito_por_pessoa_id UUID NOT NULL REFERENCES pessoas(id),
  versao_termo        TEXT NOT NULL DEFAULT 'v1',
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consentimentos_pessoa ON consentimentos (pessoa_id);

ALTER TABLE consentimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consentimentos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consentimentos_select" ON consentimentos;
CREATE POLICY "consentimentos_select" ON consentimentos
  FOR SELECT
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP POLICY IF EXISTS "consentimentos_insert" ON consentimentos;
CREATE POLICY "consentimentos_insert" ON consentimentos
  FOR INSERT
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));
-- Sem policy de UPDATE/DELETE para ninguém: histórico de consentimento é imutável.

DROP TRIGGER IF EXISTS trg_auditoria_consentimentos ON consentimentos;
CREATE TRIGGER trg_auditoria_consentimentos
  AFTER INSERT ON consentimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. Solicitações de exportação/exclusão
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitacoes_lgpd (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id      UUID NOT NULL REFERENCES pessoas(id),
  tipo           TEXT NOT NULL CHECK (tipo IN ('EXPORTAR', 'EXCLUIR')),
  status         TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONCLUIDA', 'NEGADA')),
  solicitado_por UUID NOT NULL REFERENCES usuarios(id),
  solicitado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_em   TIMESTAMPTZ,
  observacoes    TEXT
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_lgpd_pessoa ON solicitacoes_lgpd (pessoa_id);

ALTER TABLE solicitacoes_lgpd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitacoes_lgpd_rw_gestao_secretaria" ON solicitacoes_lgpd;
CREATE POLICY "solicitacoes_lgpd_rw_gestao_secretaria" ON solicitacoes_lgpd
  FOR ALL
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP TRIGGER IF EXISTS trg_auditoria_solicitacoes_lgpd ON solicitacoes_lgpd;
CREATE TRIGGER trg_auditoria_solicitacoes_lgpd
  AFTER INSERT OR UPDATE ON solicitacoes_lgpd
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 3. Exportar dados de uma Pessoa — RPC (não a rota de leitura "best-effort" do
--    log_acesso(): aqui o registro EXPORT em auditoria é gravado DENTRO da mesma
--    função/transação, então é garantido, não depende do cliente lembrar de chamar
--    nada depois.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_exportar_pessoa(p_pessoa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para exportar dados de pessoas.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'pessoa', (SELECT to_jsonb(x) FROM (SELECT * FROM pessoas WHERE id = p_pessoa_id) x),
    'aluno', (SELECT to_jsonb(x) FROM (SELECT * FROM alunos WHERE pessoa_id = p_pessoa_id) x),
    'servidor', (SELECT to_jsonb(x) FROM (
      SELECT id, nome, email, telefone, cargo, area_conhecimento, data_nascimento, status_servidor
      FROM professores WHERE pessoa_id = p_pessoa_id
    ) x),
    'responsavel', (SELECT to_jsonb(x) FROM (SELECT * FROM responsaveis WHERE pessoa_id = p_pessoa_id) x),
    'alunos_sob_responsabilidade', (SELECT jsonb_agg(to_jsonb(x)) FROM (
      SELECT al.nome, ar.principal
      FROM aluno_responsaveis ar
      JOIN responsaveis r ON r.id = ar.responsavel_id
      JOIN alunos al ON al.id = ar.aluno_id
      WHERE r.pessoa_id = p_pessoa_id
    ) x),
    'consentimentos', (SELECT jsonb_agg(to_jsonb(x)) FROM (
      SELECT tipo, aceito, versao_termo, criado_em FROM consentimentos WHERE pessoa_id = p_pessoa_id ORDER BY criado_em
    ) x),
    'exportado_em', now()
  ) INTO v_result;

  INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, pessoa_afetada_id, campos_alterados)
  VALUES (auth.uid(), 'EXPORT', 'pessoas', p_pessoa_id, p_pessoa_id, '{}');

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_exportar_pessoa(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_exportar_pessoa(UUID) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 4. Excluir dados de uma Pessoa — ANONIMIZAÇÃO, não DELETE físico.
--    Decisão de produto (confirmada): a Pessoa pode ser Aluno matriculado ou Servidor
--    ativo, com notas/frequência/ocorrências/login vinculados por pessoa_id/aluno_id/
--    professor_id — um DELETE físico quebraria (ou exigiria CASCADE destruindo)
--    registros que a escola pode ter obrigação de manter por outras normas. Em vez
--    disso: os campos de IDENTIFICAÇÃO em `pessoas` são apagados/mascarados; o
--    vínculo (aluno/servidor/responsável) continua existindo com o mesmo id.
--    Isso passa pelo trigger de auditoria normal (é um UPDATE comum em `pessoas`).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_excluir_pessoa(p_pessoa_id UUID, p_solicitacao_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Apenas GESTAO pode excluir/anonimizar dados de uma pessoa.' USING ERRCODE = '42501';
  END IF;

  UPDATE pessoas
  SET nome = 'Pessoa Removida (' || substr(id::text, 1, 8) || ')',
      cpf = NULL,
      data_nascimento = NULL,
      telefone = NULL,
      email = NULL,
      foto_url = NULL,
      atualizado_em = now()
  WHERE id = p_pessoa_id;

  IF p_solicitacao_id IS NOT NULL THEN
    UPDATE solicitacoes_lgpd
    SET status = 'CONCLUIDA', concluido_em = now()
    WHERE id = p_solicitacao_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_excluir_pessoa(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_excluir_pessoa(UUID, UUID) TO authenticated;
