-- ====================================================================================
-- FICHA DO SERVIDOR — novos tipos em documentos_pessoa
--
-- Reaproveita o repositório que a Secretaria já usa (tabela documentos_pessoa + bucket
-- privado `documentos-pessoas`, só GESTAO/SECRETARIA). Só amplia a lista de tipos:
--   CERTIFICADO, DOCUMENTO_PESSOAL, ATESTADO_MEDICO, TERMO_CONVOCACAO_ASSINADO.
-- A descrição do certificado/documento fica na coluna `observacoes` (já existente).
-- Aditivo: os tipos antigos continuam válidos. Reversão no fim do arquivo.
-- ====================================================================================

ALTER TABLE documentos_pessoa DROP CONSTRAINT IF EXISTS documentos_pessoa_tipo_check;
ALTER TABLE documentos_pessoa ADD CONSTRAINT documentos_pessoa_tipo_check CHECK (tipo IN (
  'RG_CERTIDAO', 'CPF', 'COMPROVANTE_RESIDENCIA', 'HISTORICO_ESCOLAR', 'OUTRO',
  'CERTIFICADO', 'DOCUMENTO_PESSOAL', 'ATESTADO_MEDICO', 'TERMO_CONVOCACAO_ASSINADO'
));

-- REVERSÃO (só funciona se não houver linhas com os tipos novos):
--   ALTER TABLE documentos_pessoa DROP CONSTRAINT documentos_pessoa_tipo_check;
--   ALTER TABLE documentos_pessoa ADD CONSTRAINT documentos_pessoa_tipo_check CHECK (tipo IN
--     ('RG_CERTIDAO','CPF','COMPROVANTE_RESIDENCIA','HISTORICO_ESCOLAR','OUTRO'));
