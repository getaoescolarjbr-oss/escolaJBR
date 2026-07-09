-- ====================================================================================
-- FUNDAÇÃO — Etapa 2: backfill único de papéis para servidores já existentes
-- Execute DEPOIS de create_fundacao_pessoas_rbac.sql e create_fundacao_auditoria.sql.
-- Idempotente: pode rodar mais de uma vez sem duplicar (ON CONFLICT DO NOTHING).
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Garante `usuarios` para todo professor que JÁ tem login (user_id preenchido).
--    O trigger trg_professor_criar_usuario só passa a valer para inserts/updates
--    NOVOS a partir de agora — isto aqui cobre o passado.
-- ------------------------------------------------------------------------------------
INSERT INTO usuarios (id, pessoa_id)
SELECT p.user_id, p.pessoa_id
FROM professores p
WHERE p.user_id IS NOT NULL AND p.pessoa_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET pessoa_id = EXCLUDED.pessoa_id;

-- ------------------------------------------------------------------------------------
-- 2. Mapeamento cargo -> papel (aprovado):
--      Diretor / Vice-Diretor   -> GESTAO
--      Coordenador              -> COORDENACAO
--      Secretário(a)            -> SECRETARIA
--      Inspetor / Portaria      -> INSPETOR
--      demais cargos            -> PROFESSOR
--    NUTRICAO e BIBLIOTECA ficam sem nenhum usuário neste backfill — GESTAO atribui
--    manualmente depois via rpc_atribuir_papel() / tela ?modulo=usuarios.
--
--    ATENÇÃO — caso não coberto pela regra literal aprovada: os cargos
--    "Administrativo (Biblioteca)" e "Administrativo (Inspetor(a))" (categorias
--    avulsas cadastradas em ProfessorManager.tsx) NÃO batem exatamente com
--    'Inspetor'/'Portaria', então caem em PROFESSOR por este script. Se algum desses
--    servidores deveria ter INSPETOR/BIBLIOTECA, ajuste manualmente depois do backfill.
-- ------------------------------------------------------------------------------------
INSERT INTO usuario_papeis (usuario_id, papel)
SELECT
  p.user_id,
  CASE
    WHEN trim(p.cargo) IN ('Diretor', 'Vice-Diretor') THEN 'GESTAO'::papel_usuario
    WHEN trim(p.cargo) = 'Coordenador'                 THEN 'COORDENACAO'::papel_usuario
    WHEN trim(p.cargo) = 'Secretário(a)'                THEN 'SECRETARIA'::papel_usuario
    WHEN trim(p.cargo) IN ('Inspetor', 'Portaria')      THEN 'INSPETOR'::papel_usuario
    ELSE 'PROFESSOR'::papel_usuario
  END
FROM professores p
WHERE p.user_id IS NOT NULL
ON CONFLICT (usuario_id, papel) DO NOTHING;

-- ------------------------------------------------------------------------------------
-- 3. Garante GESTAO para o admin hoje hardcoded no front (gestaoescolarjbr@gmail.com),
--    inclusive se essa conta nunca teve uma linha em `professores`.
--    Isto precisa ser executado ANTES de remover o `isAdmin` hardcoded do App.tsx.
-- ------------------------------------------------------------------------------------
DO $$
DECLARE
  v_user_id   UUID;
  v_pessoa_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'gestaoescolarjbr@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum auth.users encontrado para gestaoescolarjbr@gmail.com — pule esta etapa se ainda não existe conta.';
  ELSE
    SELECT pessoa_id INTO v_pessoa_id FROM usuarios WHERE id = v_user_id;

    IF v_pessoa_id IS NULL THEN
      INSERT INTO pessoas (nome, email)
      VALUES ('Administrador Geral', 'gestaoescolarjbr@gmail.com')
      RETURNING id INTO v_pessoa_id;

      INSERT INTO usuarios (id, pessoa_id) VALUES (v_user_id, v_pessoa_id)
      ON CONFLICT (id) DO UPDATE SET pessoa_id = EXCLUDED.pessoa_id;
    END IF;

    INSERT INTO usuario_papeis (usuario_id, papel)
    VALUES (v_user_id, 'GESTAO')
    ON CONFLICT (usuario_id, papel) DO NOTHING;
  END IF;
END $$;

-- ------------------------------------------------------------------------------------
-- 4. Conferência manual (rode e confira antes de seguir para a Etapa 3)
-- ------------------------------------------------------------------------------------
-- SELECT pe.nome, pe.email, up.papel
-- FROM usuario_papeis up
-- JOIN usuarios u ON u.id = up.usuario_id
-- JOIN pessoas pe ON pe.id = u.pessoa_id
-- ORDER BY pe.nome;
