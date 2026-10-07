-- Reseta a cota de Biologia (Giovane) usada no teste da correção de
-- rpc_inserir_questoes_cota_area, na avaliação de área "2º Ano B, 2º Ano C".
-- Não mexe em nenhuma outra cota/prova.

DELETE FROM public.prova_questoes
WHERE prova_id = 'def0a8d5-05d9-4c2a-a443-75b422ee45de'
  AND question_id = '3255c804-a051-48ec-8c83-3d3e11cd773f';

UPDATE public.prova_area_cotas
SET qtd_inserida = 0,
    atualizado_em = now()
WHERE prova_id = 'def0a8d5-05d9-4c2a-a443-75b422ee45de'
  AND disciplina_id = '44c05467-306c-4fb2-ba5c-500ada2334b4';
