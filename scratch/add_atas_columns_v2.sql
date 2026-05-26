-- ========================================================
-- MIGRAÇÃO: Sistema de Atas Aprimorado - JBR Portal
-- Execute este script no Editor SQL do Supabase Dashboard
-- ========================================================

-- 1. Número sequencial global da ata (ex: 1, 2, 3...)
ALTER TABLE atas_alunos ADD COLUMN IF NOT EXISTS numero_sequencial INT;

-- 2. Data da reunião/ata
ALTER TABLE atas_alunos ADD COLUMN IF NOT EXISTS data_ata DATE;

-- 3. Texto bruto digitado pelo coordenador (antes do tratamento IA)
ALTER TABLE atas_alunos ADD COLUMN IF NOT EXISTS acordado TEXT;

-- 4. Bimestre da ata (para filtro no painel de Gestão de Atas)
ALTER TABLE atas_alunos ADD COLUMN IF NOT EXISTS bimestre_id INT DEFAULT 0;

-- Verificar resultado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'atas_alunos'
ORDER BY ordinal_position;
