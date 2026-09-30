-- ====================================================================================
-- DADOS COMPLEMENTARES DE SERVIDOR (para o Termo de Ajuste e Compromisso — Professor
-- Convocado e futuros documentos de RH).
--
-- `pessoas` já guarda nome, CPF, nascimento, telefone e e-mail. Esta tabela guarda o
-- restante que o termo exige e que não existia no banco: RG, título/zona/seção eleitoral,
-- endereço, telefone fixo, formação e matrícula funcional. É dado pessoal sensível de
-- servidor: só GESTAO e SECRETARIA leem e escrevem (nem o próprio servidor, por ora).
-- Aditivo: não altera nenhuma tabela existente. Reversão no fim do arquivo.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS servidor_dados_complementares (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id         UUID NOT NULL UNIQUE REFERENCES pessoas(id) ON DELETE CASCADE,
  rg                TEXT,
  titulo_eleitor    TEXT,
  zona_eleitoral    TEXT,
  secao_eleitoral   TEXT,
  endereco          TEXT,
  telefone_fixo     TEXT,
  formacao          TEXT,
  matricula_servidor TEXT,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE servidor_dados_complementares ENABLE ROW LEVEL SECURITY;
ALTER TABLE servidor_dados_complementares FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "serv_compl_gestao_secretaria" ON servidor_dados_complementares;
CREATE POLICY "serv_compl_gestao_secretaria" ON servidor_dados_complementares FOR ALL TO authenticated
  USING ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')))
  WITH CHECK ((SELECT public.usuario_tem_papel('GESTAO')) OR (SELECT public.usuario_tem_papel('SECRETARIA')));

DROP TRIGGER IF EXISTS trg_auditoria_servidor_dados_complementares ON servidor_dados_complementares;
CREATE TRIGGER trg_auditoria_servidor_dados_complementares
  AFTER INSERT OR UPDATE OR DELETE ON servidor_dados_complementares
  FOR EACH ROW EXECUTE FUNCTION fn_auditoria();

-- REVERSÃO (descarta os dados gravados):
--   DROP TABLE IF EXISTS servidor_dados_complementares;
