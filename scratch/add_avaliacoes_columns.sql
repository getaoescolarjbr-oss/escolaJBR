-- ============================================================
-- MIGRATION: Adicionar colunas de data e publicação na tabela avaliacoes
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- Projeto: hqonnxnwozfwkpqgabpf (portal-professor-jbr)
-- ============================================================

-- 1. Adicionar coluna data_avaliacao (Data da Avaliação) se não existir
ALTER TABLE public.avaliacoes 
ADD COLUMN IF NOT EXISTS data_avaliacao DATE;

-- 2. Adicionar coluna publicada (Publicado no Calendário Escolar) se não existir
ALTER TABLE public.avaliacoes 
ADD COLUMN IF NOT EXISTS publicada BOOLEAN DEFAULT FALSE;

-- 3. Habilitar políticas RLS adicionais se necessário (normalmente as existentes de ALL/UPDATE já cobrem)
-- Para garantir que todos autenticados possam ler e editar avaliações:
-- CREATE POLICY "Permitir leitura de avaliacoes para autenticados" ON public.avaliacoes FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Permitir update de avaliacoes para autenticados" ON public.avaliacoes FOR UPDATE TO authenticated USING (true);
