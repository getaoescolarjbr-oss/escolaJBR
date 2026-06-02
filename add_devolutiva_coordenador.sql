-- =====================================================================
-- MIGRATION: Adicionar campo de devolutiva da coordenação em ocorrências
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================================

-- 1. Adicionar coluna devolutiva_coordenador na tabela ocorrências
ALTER TABLE ocorrências 
  ADD COLUMN IF NOT EXISTS devolutiva_coordenador TEXT;

-- 2. (Garantia) Confirmar que as colunas de visto também existem
ALTER TABLE ocorrências 
  ADD COLUMN IF NOT EXISTS visto_coordenador BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_visualizacao_coordenador TIMESTAMP WITH TIME ZONE;

-- 3. Índice para performance (se ainda não existir)
CREATE INDEX IF NOT EXISTS idx_ocorrencias_visto_coordenador 
  ON ocorrências(visto_coordenador) 
  WHERE visto_coordenador = FALSE;
