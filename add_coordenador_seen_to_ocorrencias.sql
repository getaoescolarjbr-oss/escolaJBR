-- =====================================================================
-- MIGRATION: Adicionar campos de leitura da coordenação em ocorrências
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================================

-- 1. Adicionar colunas seen e timestamp na tabela ocorrências se não existirem
ALTER TABLE ocorrências 
  ADD COLUMN IF NOT EXISTS visto_coordenador BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_visualizacao_coordenador TIMESTAMP WITH TIME ZONE;

-- 2. (Opcional) Criar um índice para otimizar a busca por ocorrências pendentes
CREATE INDEX IF NOT EXISTS idx_ocorrencias_visto_coordenador 
  ON ocorrências(visto_coordenador) 
  WHERE visto_coordenador = FALSE;
