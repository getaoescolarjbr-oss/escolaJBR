-- ====================================================================================
-- VINCULAR SERVIDOR SEM CONTA E ATRIBUIR PAPEL PCPI
--
-- ATENÇÃO: Execute cada bloco separadamente (um de cada vez).
-- Substitua os valores conforme necessário.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- PASSO 1: Verifique se Janaina Felix da Silva tem conta no auth.users
-- ------------------------------------------------------------------------------------
SELECT id, email, created_at
FROM auth.users
WHERE email ILIKE '%janaina%felix%'
   OR email ILIKE '%janaina.101124%';


-- ------------------------------------------------------------------------------------
-- PASSO 2: Veja o ID dela na tabela professores
-- ------------------------------------------------------------------------------------
SELECT id, nome, email, user_id
FROM public.professores
WHERE nome ILIKE '%janaina%felix%';


-- ------------------------------------------------------------------------------------
-- PASSO 3: Se ela JÁ TEM conta em auth.users mas user_id é NULL na tabela professores,
--          execute este bloco substituindo os valores:
--
--   <AUTH_USER_ID>   = id retornado no PASSO 1
--   <PROFESSOR_ID>   = id retornado no PASSO 2
-- ------------------------------------------------------------------------------------
/*
UPDATE public.professores
SET user_id = '<AUTH_USER_ID>'::uuid
WHERE id = '<PROFESSOR_ID>'::uuid;
*/

-- Após o UPDATE acima, o trigger fn_professor_criar_usuario
-- cria automaticamente o registro em public.usuarios.

-- ------------------------------------------------------------------------------------
-- PASSO 4: Verifique se o usuário foi criado em public.usuarios
-- ------------------------------------------------------------------------------------
/*
SELECT u.id, pe.nome, pe.email, u.ativo
FROM public.usuarios u
JOIN public.pessoas pe ON pe.id = u.pessoa_id
WHERE u.id = '<AUTH_USER_ID>'::uuid;
*/

-- ------------------------------------------------------------------------------------
-- PASSO 5: Atribua o papel PCPI ao usuário
-- ------------------------------------------------------------------------------------
/*
INSERT INTO public.usuario_papeis (usuario_id, papel)
VALUES ('<AUTH_USER_ID>'::uuid, 'PCPI')
ON CONFLICT (usuario_id, papel) DO NOTHING;
*/

-- ------------------------------------------------------------------------------------
-- SE ELA NÃO TEM CONTA AINDA em auth.users:
--   → Ela precisa fazer "Primeiro Acesso" no portal usando o e-mail cadastrado.
--   → Após o primeiro acesso, volte e execute os PASSOs 3, 4 e 5 acima.
--
-- Ou você pode criar a conta manualmente:
--   → Supabase > Authentication > Users > Invite User (usando o email dela)
--   → Depois siga os PASSOs 3, 4 e 5.
-- ------------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------------
-- CONSULTA RÁPIDA: Ver todos os servidores e seus vínculos
-- ------------------------------------------------------------------------------------
SELECT
  pr.id AS professor_id,
  pr.nome,
  pr.email AS email_professor,
  pr.user_id,
  pr.area_conhecimento,
  u.id   AS usuario_id,
  u.ativo
FROM public.professores pr
LEFT JOIN public.usuarios u ON u.id = pr.user_id
ORDER BY pr.nome;
