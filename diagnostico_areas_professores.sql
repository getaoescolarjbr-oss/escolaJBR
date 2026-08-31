-- ====================================================================================
-- DIAGNÓSTICO: Verifique os valores reais de area_conhecimento na tabela professores
-- Execute no SQL Editor do Supabase
-- ====================================================================================

-- 1. Veja todos os professores e seus valores de area_conhecimento (exatos)
SELECT id, nome, area_conhecimento, user_id IS NOT NULL AS tem_conta
FROM public.professores
ORDER BY area_conhecimento, nome;

-- 2. Lista os valores únicos de area_conhecimento para confirmar a grafia exata
SELECT DISTINCT area_conhecimento, count(*) as total
FROM public.professores
GROUP BY area_conhecimento
ORDER BY area_conhecimento;
