-- Script para adicionar campos de CID na tabela de alunos

ALTER TABLE alunos ADD COLUMN IF NOT EXISTS cid_codigo TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS cid_descricao TEXT;

-- Garantir que as permissões de leitura/escrita continuem ativas para as políticas RLS existentes
COMMENT ON COLUMN alunos.cid_codigo IS 'Código CID do aluno (Classificação Internacional de Doenças) para alunos com laudo.';
COMMENT ON COLUMN alunos.cid_descricao IS 'Descrição do CID / diagnóstico do aluno.';
