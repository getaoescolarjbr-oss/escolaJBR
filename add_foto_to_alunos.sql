-- Script para adicionar foto do aluno na tabela alunos
-- As imagens são armazenadas no Supabase Storage (bucket), não no banco de dados.
-- Apenas a URL pública da imagem é salva nesta coluna.

ALTER TABLE alunos ADD COLUMN IF NOT EXISTS foto_url TEXT;

COMMENT ON COLUMN alunos.foto_url IS 'URL pública da foto do aluno armazenada no Supabase Storage (bucket fotos-alunos).';

-- ============================================================
-- EXECUTE TAMBÉM NO SUPABASE DASHBOARD > Storage:
-- 1. Crie um bucket chamado: fotos-alunos
-- 2. Marque como "Public bucket"
-- ============================================================
-- Ou via SQL (caso o seu plano suporte):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-alunos', 'fotos-alunos', true)
-- ON CONFLICT (id) DO NOTHING;

-- Política para leitura pública das fotos
-- CREATE POLICY "Fotos públicas" ON storage.objects FOR SELECT USING (bucket_id = 'fotos-alunos');
-- CREATE POLICY "Upload autenticado" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fotos-alunos' AND auth.role() = 'authenticated');
-- CREATE POLICY "Update autenticado" ON storage.objects FOR UPDATE USING (bucket_id = 'fotos-alunos' AND auth.role() = 'authenticated');
