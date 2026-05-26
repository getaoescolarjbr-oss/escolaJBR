-- ============================================================
-- SQL PARA INSERIR ALUNOS NOVOS (bypass RLS via SQL Editor)
-- Execute no painel SQL do Supabase:
-- https://supabase.com/dashboard/project/hqonnxnwozfwkpqgabpf/sql/new
-- ============================================================

-- ETAPA 1: Inserir alunos novos

-- 7º Ano A | nº 32
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('IANNA CLEIDE BARBOSA DA SILVA', '72fdf92e-4b47-4d97-8e02-c2e89548c80e', 32, 'Ativo');

-- 7º Ano A | nº 33
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('NICOLI KIMBERLY RODRIGUES MARTINS', '72fdf92e-4b47-4d97-8e02-c2e89548c80e', 33, 'Ativo');

-- 7º Ano A | nº 34
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('MARIANA FLORENCIO COSTA', '72fdf92e-4b47-4d97-8e02-c2e89548c80e', 34, 'Ativo');

-- 9º Ano A | nº 44
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('HEITOR NUNES DE OLIVEIRA', '9c14383d-8343-4b86-b2fe-ab2f4394b750', 44, 'Ativo');

-- 9º Ano A | nº 45
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('DANIEL SILVA DE OLIVEIRA', '9c14383d-8343-4b86-b2fe-ab2f4394b750', 45, 'Ativo');

-- 9º Ano A | nº 46
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('RAPHAELA DANTAS DE ARAUJO', '9c14383d-8343-4b86-b2fe-ab2f4394b750', 46, 'Ativo');

-- 1º Ano A | nº 39
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('KAIO RODRIGUES GOMES MACIEL', '40240976-446c-43a0-89ee-41ee204125ea', 39, 'Ativo');

-- 1º Ano A | nº 40
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('WESLEY MODESTO DE OLIVEIRA', '40240976-446c-43a0-89ee-41ee204125ea', 40, 'Ativo');

-- 1º Ano A | nº 41
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('EMILY GABRIELI GALVÃO MION', '40240976-446c-43a0-89ee-41ee204125ea', 41, 'Ativo');

-- 1º Ano B | nº 38
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('ISADORA LEITE RODI', '2ddb923f-70ef-4be0-a90d-c7fca164530b', 38, 'Ativo');

-- 1º Ano B | nº 39
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('JOÃO DA COSTA MADIA', '2ddb923f-70ef-4be0-a90d-c7fca164530b', 39, 'Ativo');

-- 1º Ano B | nº 40
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('RAFHAELLA FERNANDES CAVALCANTE', '2ddb923f-70ef-4be0-a90d-c7fca164530b', 40, 'Ativo');

-- 1º Ano C | nº 39
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('EMILY GABRIELI GALVÃO MION', '37cefbab-86af-42ab-bf68-f6420c111d36', 39, 'Remanejado');

-- 1º Ano D | nº 41
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('RENAN PIETRO LOPES DE OLIVEIRA', '74d7a7c2-7ec7-4124-9def-70a870a2301a', 41, 'Ativo');

-- 1º Ano D | nº 42
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('KAMILLY VITÓRIA GUEDES', '74d7a7c2-7ec7-4124-9def-70a870a2301a', 42, 'Ativo');

-- 2º Ano A | nº 32
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('CAIO HENRIQUE BATISTA DOS SANTOS', '97e90719-2c78-4839-89f1-29fa5b648d34', 32, 'Ativo');

-- 2º Ano A | nº 33
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('PIETRO NUNES DOS SANTOS', '97e90719-2c78-4839-89f1-29fa5b648d34', 33, 'Ativo');

-- 2º Ano A | nº 34
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('VITÓRIA ALVES DOS SANTOS', '97e90719-2c78-4839-89f1-29fa5b648d34', 34, 'Ativo');

-- 2º Ano A | nº 35
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('NATIELY SOUZA DA PAZ SANTOS', '97e90719-2c78-4839-89f1-29fa5b648d34', 35, 'Ativo');

-- 2º Ano C | nº 31
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('LARYSSA BEATRYZ CORONEL RIBEIRO', '689045b6-42fb-4b34-9dec-7f4bd2cd6d13', 31, 'Ativo');

-- 2º Ano C | nº 32
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('STELLA RODRIGUES DE SOUSA - PEDRO HENRIQUE RODRIGUES DE SOUSA', '689045b6-42fb-4b34-9dec-7f4bd2cd6d13', 32, 'Transferido');

-- 2º Ano C | nº 33
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('MANUELLY FELIX FERREIRA', '689045b6-42fb-4b34-9dec-7f4bd2cd6d13', 33, 'Ativo');

-- 2º Ano C | nº 34
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('LAÍS AVILA DA SILVA', '689045b6-42fb-4b34-9dec-7f4bd2cd6d13', 34, 'Ativo');

-- 2º Ano C | nº 35
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('EMILLY ALMEIDA RODRIGUES', '689045b6-42fb-4b34-9dec-7f4bd2cd6d13', 35, 'Ativo');

-- 3º Ano A | nº 31
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('WILHAN ALVES DE LIMA', '3666567c-2f58-41ab-8d21-f1592e71812d', 31, 'Ativo');

-- 3º Ano B | nº 30
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('VÍTOR HUGO VIEIRA SAMBRANA', 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a', 30, 'Transferido');

-- 3º Ano B | nº 31
INSERT INTO alunos (nome, turma_id, aluno_numero, status)
VALUES ('VÍTOR HUGO VIEIRA SAMBRANA', 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a', 31, 'Ativo');


-- ============================================================
-- ETAPA 2: Inserir notas dos alunos novos
-- ============================================================

-- EMILY GABRIELI GALVÃO MION | Arte: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '8c104517-5f09-4109-9de5-2d02a4daa035', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Biologia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'b6228601-e835-4236-b1cd-b9f38fc25a59', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Educação Física: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3cadec93-5872-4f56-93a2-71ae09442b40', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Filosofia: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '751e2eec-6b23-414a-bc58-04b536bc5a5f', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Física: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'deae9fa4-90a4-4b2c-a12c-ad68abd4044d', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Geografia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '5af2f07b-e860-4ce2-99a5-622f9f922b7d', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | História: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '778f508e-f828-4028-9476-ad43ab0c3f17', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Língua Inglesa: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '9fc3b138-9729-454c-a4c2-a0005a557583', id, 9
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Língua Portuguesa - Literatura e Produção Textual: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3ef16333-26a9-4b90-be42-27db02274bef', id, 7
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Matemática: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '9a82c145-17dd-417d-9db9-220a27d0f45f', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Matemática - Geometria: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '5826bff6-6c31-4c0a-b488-a0d008b11c6f', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Língua Portuguesa: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '1ee185ff-16cd-4681-97e7-53eb753bc063', id, 7
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Química: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '1981eb9d-4e44-4d42-b365-1586ae22c169', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Sociologia: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '49fc17ea-218c-442c-b35b-5e62d3dc1752', id, 7
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '40240976-446c-43a0-89ee-41ee204125ea'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Arte: 8.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '915a7b65-697d-4458-98f2-fe7d027997f7', id, 8.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Biologia: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '56b0bee1-05e9-47cc-8ce9-11f449f759b1', id, 8
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Educação Física: 8.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'd46eb2ab-e678-4696-a1d4-61a661b422fa', id, 8.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Filosofia: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'e11096ba-84cb-4274-8b1b-d6386bf4b1c0', id, 7
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Física: 8.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3ac56ef7-9359-4a0f-a553-4473d7f8a23b', id, 8.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Geografia: 8.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '61b46d2e-b779-4226-80c9-a57cf720f803', id, 8.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | História: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'dc4be237-c177-40e9-b21e-d852f4f2ca04', id, 9
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Laboratório de Linguas: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'f7d3a842-def4-411c-ab67-04b231698ef7', id, 7.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Língua Espanhola: 9.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'afa9571f-d4af-4e37-b388-9b43fcb87d66', id, 9.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Língua Inglesa: 9.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'abfd905a-cc3e-4d1a-b958-bc295da013b9', id, 9.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Língua Portuguesa - Literatura e Produção Textual: 9.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '9f1cc343-c210-446e-83e1-4c8f47905d98', id, 9.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Matemática: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'b16a5907-fb39-43cc-af38-ad03bc6ca8c2', id, 6.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Matemática - Geometria: 8.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'cf0b70f2-f653-4916-88e8-7a7e7241ab5d', id, 8.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Prática de Escrita e Estilo: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '7be93159-41d4-49ac-adfd-0b57c1ac22f3', id, 9
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Língua Portuguesa: 8.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '4aeeb8bd-a8ff-4a59-ad77-11f6b426ada9', id, 8.5
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Química: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ba5750a0-c515-432c-92f5-f8e8b21276a0', id, 9
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- ISADORA LEITE RODI | Sociologia: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ec121659-72e3-4698-abec-5e5e6c5df617', id, 9
FROM alunos WHERE nome = 'ISADORA LEITE RODI' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Arte: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '915a7b65-697d-4458-98f2-fe7d027997f7', id, 7
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Biologia: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '56b0bee1-05e9-47cc-8ce9-11f449f759b1', id, 6.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Educação Física: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'd46eb2ab-e678-4696-a1d4-61a661b422fa', id, 8
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Filosofia: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'e11096ba-84cb-4274-8b1b-d6386bf4b1c0', id, 7.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Física: 5.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3ac56ef7-9359-4a0f-a553-4473d7f8a23b', id, 5.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Geografia: 8.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '61b46d2e-b779-4226-80c9-a57cf720f803', id, 8.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | História: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'dc4be237-c177-40e9-b21e-d852f4f2ca04', id, 8
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Laboratório de Linguas: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'f7d3a842-def4-411c-ab67-04b231698ef7', id, 7.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Língua Espanhola: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'afa9571f-d4af-4e37-b388-9b43fcb87d66', id, 8
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Língua Inglesa: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'abfd905a-cc3e-4d1a-b958-bc295da013b9', id, 8
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Língua Portuguesa - Literatura e Produção Textual: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '9f1cc343-c210-446e-83e1-4c8f47905d98', id, 8
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Matemática: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'b16a5907-fb39-43cc-af38-ad03bc6ca8c2', id, 7.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Matemática - Geometria: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'cf0b70f2-f653-4916-88e8-7a7e7241ab5d', id, 6.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Prática de Escrita e Estilo: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '7be93159-41d4-49ac-adfd-0b57c1ac22f3', id, 9
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Língua Portuguesa: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '4aeeb8bd-a8ff-4a59-ad77-11f6b426ada9', id, 6.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Química: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ba5750a0-c515-432c-92f5-f8e8b21276a0', id, 6.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- JOÃO DA COSTA MADIA | Sociologia: 9.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ec121659-72e3-4698-abec-5e5e6c5df617', id, 9.5
FROM alunos WHERE nome = 'JOÃO DA COSTA MADIA' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Arte: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '915a7b65-697d-4458-98f2-fe7d027997f7', id, 6.5
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Biologia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '56b0bee1-05e9-47cc-8ce9-11f449f759b1', id, 6
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Educação Física: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'd46eb2ab-e678-4696-a1d4-61a661b422fa', id, 6
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Filosofia: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'e11096ba-84cb-4274-8b1b-d6386bf4b1c0', id, 8
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Física: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3ac56ef7-9359-4a0f-a553-4473d7f8a23b', id, 6
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Geografia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '61b46d2e-b779-4226-80c9-a57cf720f803', id, 6
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | História: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'dc4be237-c177-40e9-b21e-d852f4f2ca04', id, 7
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Laboratório de Linguas: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'f7d3a842-def4-411c-ab67-04b231698ef7', id, 6
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Língua Espanhola: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'afa9571f-d4af-4e37-b388-9b43fcb87d66', id, 7
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Língua Inglesa: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'abfd905a-cc3e-4d1a-b958-bc295da013b9', id, 6
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Língua Portuguesa - Literatura e Produção Textual: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '9f1cc343-c210-446e-83e1-4c8f47905d98', id, 7.5
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Matemática: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'b16a5907-fb39-43cc-af38-ad03bc6ca8c2', id, 6.5
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Matemática - Geometria: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'cf0b70f2-f653-4916-88e8-7a7e7241ab5d', id, 6.5
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Prática de Escrita e Estilo: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '7be93159-41d4-49ac-adfd-0b57c1ac22f3', id, 8
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Língua Portuguesa: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '4aeeb8bd-a8ff-4a59-ad77-11f6b426ada9', id, 6
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Química: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ba5750a0-c515-432c-92f5-f8e8b21276a0', id, 7
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- RAFHAELLA FERNANDES CAVALCANTE | Sociologia: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ec121659-72e3-4698-abec-5e5e6c5df617', id, 9
FROM alunos WHERE nome = 'RAFHAELLA FERNANDES CAVALCANTE' AND turma_id = '2ddb923f-70ef-4be0-a90d-c7fca164530b'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Arte: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'a5b663fd-6075-40cc-8841-0b0a4fece831', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Biologia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '5c7c0a78-0f9c-4678-ad39-92200717e894', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Educação Física: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'afc08825-0fa1-4032-8a3f-a8f700dc3535', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Filosofia: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'f96a440f-c031-4398-b011-ec8305a8d879', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Física: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'bdc54a04-160a-43a1-a7d5-e18da178e48c', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Geografia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'dd7e3df5-a3c9-4c40-b7b2-0ac345b0f32a', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | História: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '509dabbe-19af-4216-8230-fb0a3ba3ee6e', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Língua Inglesa: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '0c4baabc-50c5-492a-8729-cbc9810b19f7', id, 9
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Língua Portuguesa - Literatura e Produção Textual: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '0a00758e-f4f3-4dd4-86be-2475c4b0472a', id, 7
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Matemática: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'af0a0e4a-8c20-433e-808f-1b9506698fcb', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Matemática - Geometria: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'b0ad7402-cdcf-499e-a8f6-37a68755327c', id, 8
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Língua Portuguesa: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '5dde8c32-0a49-4ffc-871d-1e7fd42d9dae', id, 7
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Química: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '55d66ea7-43d9-44e6-8927-5c0de4f5cab1', id, 6
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- EMILY GABRIELI GALVÃO MION | Sociologia: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '786577b4-aac6-4454-b516-74423e0fedbb', id, 7
FROM alunos WHERE nome = 'EMILY GABRIELI GALVÃO MION' AND turma_id = '37cefbab-86af-42ab-bf68-f6420c111d36'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Arte: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'e515d107-e08a-469d-af69-d54a6064035c', id, 6
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Biologia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '66d7f4bd-ea02-4c53-bfcc-58c3f7b015cd', id, 6
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Educação Física: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '01cb8490-2e14-4067-bccd-cfdb8f30b29e', id, 7
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Filosofia: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '71ba4ecf-e4c8-4d4e-892e-15fa6ed3d977', id, 9
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Física: 4.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ecabfd09-7384-4e4d-a950-b1c75fcb3052', id, 4.5
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Geografia: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '184dd78b-67d8-4865-8323-c22e97dab80c', id, 8
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | História: 8.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3c6b5657-e400-46ea-b773-e772e91f66ed', id, 8.5
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Laboratório de Linguas: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '2e7cd958-218e-4085-b000-a53ab242e74b', id, 7.5
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Língua Espanhola: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ccb288e6-d86e-46a5-abc9-dbecaea79386', id, 7
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Língua Inglesa: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '723036bc-8471-4617-b118-ea800fe56253', id, 6.5
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Língua Portuguesa - Literatura e Produção Textual: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '171fd502-247a-48f3-989d-ba359d88e378', id, 8
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Matemática: 5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'f398c86e-ba29-401a-82ad-bd36be8b3b81', id, 5
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Matemática - Geometria: 5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '37f6f185-c9c2-4b68-9630-65656719cc79', id, 5
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Prática de Escrita e Estilo: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '555cc7e5-2da4-48fc-8af9-d21ff63d3c83', id, 7
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Língua Portuguesa: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'bb65ec9f-6b2e-4aba-8587-39e49cc9aaf6', id, 8
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Química: 5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '9fecc7f2-748f-43a8-bb7d-2ea1e739bf8b', id, 5
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Sociologia: 9
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '8167e247-4e7b-4de5-acf2-bd36cf30f419', id, 9
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Unidade Curricular I: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '6855f219-cb0f-4001-b257-b733286a153f', id, 7
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Unidade Curricular II: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'be96ae79-60cf-40d4-a0d0-7c96008e666c', id, 6
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Unidade Curricular III: 8
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '03d71ede-bf6a-4b2f-917b-88b441319056', id, 8
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- LARYSSA BEATRYZ CORONEL RIBEIRO | Unidade Curricular IV: 3
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ef6a1bed-d334-4492-8208-1764a5d78aad', id, 3
FROM alunos WHERE nome = 'LARYSSA BEATRYZ CORONEL RIBEIRO' AND turma_id = '689045b6-42fb-4b34-9dec-7f4bd2cd6d13'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Arte: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '12c68ce6-5df2-41b8-884f-663924270713', id, 6.5
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Biologia: 4
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '9e492c4b-2140-40a3-9d0a-82aca2085646', id, 4
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Educação Física: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '1358252f-b6a0-4510-a6ba-69d88f4df00b', id, 7
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Filosofia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'a40ec9d3-6444-4d92-b5ce-5032f807b536', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Física: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '77f7aef3-3fbe-4d19-b9ad-b7323584478a', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Geografia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '9dffb16b-98a6-4032-85b6-9bc3301bb250', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | História: 7
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '28503b40-3241-4e64-bd93-c71334fc996c', id, 7
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Laboratório de Linguas: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'a7c5ee48-9600-4ca8-97f5-6cdc1c1b9499', id, 6.5
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Língua Espanhola: 6.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'ed8d2499-a638-4aad-b7bf-f01ea9a82dec', id, 6.5
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Língua Inglesa: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '06b46df8-57bb-41b7-a6dc-2c849782fa87', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Língua Portuguesa - Literatura e Produção Textual: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'aeb5065a-9018-45b5-b896-fff43f4f087f', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Matemática: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'cc60a89d-ee14-4278-83f3-d9efa8cb40df', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Matemática - Geometria: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '09268a5a-360b-41d2-b757-0a9a4cd78ebe', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Prática de Escrita e Estilo: 5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3ab5675f-b143-4783-afa5-03d47e027af5', id, 5
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Língua Portuguesa: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '4230c751-b230-415d-93f6-9f5bc3e4a404', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Química: 3
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '882fd5a5-1add-423d-b702-73260365f760', id, 3
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Sociologia: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '2d69f713-d58d-4a32-84e1-47fc17cc2a17', id, 7.5
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Unidade Curricular I: 4
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '885af3e6-90d8-4ee1-9dec-13298d5b04ce', id, 4
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Unidade Curricular II: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '8eac2145-08f6-44a2-b5d7-276a3879e7aa', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Unidade Curricular III: 5.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '90465b77-8500-4843-ad8d-db10d9fc0883', id, 5.5
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- WILHAN ALVES DE LIMA | Unidade Curricular IV: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '70089812-d533-4571-afc5-f4c044b1ea31', id, 6
FROM alunos WHERE nome = 'WILHAN ALVES DE LIMA' AND turma_id = '3666567c-2f58-41ab-8d21-f1592e71812d'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Arte: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '2640a8c3-2e75-423a-bafe-59190ed0c283', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Biologia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3f09c73f-d286-4ff2-b02a-e863fc4f0eb6', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Educação Física: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '1d527728-d375-409d-bbf1-b4490a51253e', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Filosofia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '4552aa76-9116-4ad5-8614-3ffaf62362e7', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Física: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'b17480f9-bd3d-4d88-af87-fd0d528fffc6', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Geografia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '8d18fac3-366a-4b1d-bad8-4e27beebb09d', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | História: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '65d931cc-c7fa-4e40-8c1a-93880e31c42d', id, 7.5
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Laboratório de Linguas: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'a4979109-316b-4483-8a57-783972a48a68', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Língua Espanhola: 2
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '10f119d2-d8bd-4601-9b25-3f4ae7514360', id, 2
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Língua Inglesa: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'e7d7012c-88b2-4bff-8643-e3258c586889', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Língua Portuguesa - Literatura e Produção Textual: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '1ad7cab5-ea29-4e86-be45-6f86776478bc', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Matemática: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '1c607746-1839-4f21-a11e-e20b8892863a', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Matemática - Geometria: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '7d2fccfa-259e-41a7-9cd0-d8eb4217cf56', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Prática de Escrita e Estilo: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '76394571-58de-4226-bbef-f74da12ef40d', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Língua Portuguesa: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '92046c55-04ea-4976-9839-1d29bbd0f3c3', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Química: 5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT 'afcfaf1c-7e51-4aef-8478-937049ac799e', id, 5
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Sociologia: 6
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '44eee6c1-81e7-4c5a-b185-5d1e5da54faa', id, 6
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Unidade Curricular I: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '3ad1b221-10b3-4081-8d95-7cc055dd6134', id, 7.5
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Unidade Curricular II: 7.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '37ae63a5-931a-4c71-874d-ed9cba977c1a', id, 7.5
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Unidade Curricular III: 10
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '29d67b10-e750-4466-9a70-06334af10935', id, 10
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

-- VÍTOR HUGO VIEIRA SAMBRANA | Unidade Curricular IV: 3.5
INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
SELECT '85278575-620c-4a97-afd1-f8f5a3e6f30c', id, 3.5
FROM alunos WHERE nome = 'VÍTOR HUGO VIEIRA SAMBRANA' AND turma_id = 'e7c649a9-a5e8-4cb5-aa6d-4b180e3c622a'
ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;
