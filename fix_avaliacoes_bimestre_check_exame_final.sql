-- =====================================================
-- Fix: avaliacoes_bimestre_id_check bloqueava o Exame Final
-- =====================================================
-- O Exame Final usa bimestre_id = 5 (ver ExameFinalPanel.tsx e
-- ReportsPanel.tsx), mas a constraint só permitia 1-4. Toda tentativa de
-- "Abrir Lançamento de Exame" era rejeitada pelo banco (INSERT em
-- avaliacoes com bimestre_id=5) -- e o front-end não mostrava o erro,
-- então parecia que o botão simplesmente não fazia nada.
--
-- JÁ APLICADO diretamente no banco de produção em 2026-07-09. Este arquivo
-- só documenta a mudança para o schema ficar consistente com o que existe
-- de verdade no Supabase.

ALTER TABLE avaliacoes DROP CONSTRAINT avaliacoes_bimestre_id_check;
ALTER TABLE avaliacoes ADD CONSTRAINT avaliacoes_bimestre_id_check
  CHECK (bimestre_id >= 1 AND bimestre_id <= 5);
