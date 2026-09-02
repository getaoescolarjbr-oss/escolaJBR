-- ====================================================================================
-- SEGUNDA ETAPA DO FECHAMENTO: escrita em `professores` e funções chamáveis por anon
--
-- Continuação de fechar_exposicao_anon.sql, que tratou o acesso anônimo às tabelas.
-- Aqui vão as duas pontas que aquele arquivo deixou anotadas.
-- ====================================================================================


-- ------------------------------------------------------------------------------------
-- 1. `professores`: escrever deixa de ser livre para qualquer conta logada
--
-- As políticas eram "Atualização de professores" e "Inserção de professores", ambas
-- [authenticated] com USING (true). Como `authenticated` inclui a conta de aluno do
-- BiblioClube, qualquer aluno aprovado podia reescrever — ou criar — a ficha de um
-- servidor: nome, e-mail, cargo, e o user_id que amarra a ficha a uma conta de login.
--
-- O que o app realmente faz com essa tabela, verificado tela a tela:
--   * o próprio professor edita a SUA linha — App.tsx e SettingsModal filtram por
--     user_id = o dele, e o primeiro acesso (App.tsx, Login.tsx) filtra por e-mail;
--   * o painel de gestão (ProfessorManager) cria, edita e exclui qualquer uma.
--
-- As políticas abaixo dizem exatamente isso. A de auto-vinculação no primeiro acesso,
-- que já existia e é mais estrita (só linha sem user_id), continua intacta ao lado —
-- políticas permissivas se somam, e mantê-la documenta o caso especial.
-- ------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Atualização de professores" ON public.professores;
DROP POLICY IF EXISTS "Inserção de professores" ON public.professores;

DROP POLICY IF EXISTS "professores_update_proprio_ou_gestao" ON public.professores;
CREATE POLICY "professores_update_proprio_ou_gestao" ON public.professores
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR email = (auth.jwt() ->> 'email')
    OR public.usuario_tem_papel('GESTAO')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR email = (auth.jwt() ->> 'email')
    OR public.usuario_tem_papel('GESTAO')
  );

-- O e-mail no WITH CHECK do INSERT cobre um caso real: a conta de gestão se
-- autoprovisiona na primeira entrada (App.tsx cria a própria linha), e nesse instante
-- ela pode ainda não ter o papel GESTAO gravado.
DROP POLICY IF EXISTS "professores_insert_gestao" ON public.professores;
CREATE POLICY "professores_insert_gestao" ON public.professores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.usuario_tem_papel('GESTAO')
    OR email = (auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "professores_delete_gestao" ON public.professores;
CREATE POLICY "professores_delete_gestao" ON public.professores
  FOR DELETE TO authenticated
  USING (public.usuario_tem_papel('GESTAO'));


-- ------------------------------------------------------------------------------------
-- 2. Funções: anon deixa de poder chamar 90 delas
--
-- Eram 301 com EXECUTE para anon. A conta real: 23 são funções de gatilho (o PostgREST
-- não as alcança), 188 vêm de extensões, e 90 eram de fato chamáveis pela internet.
--
-- Nenhuma estava explorável hoje: as que fazem algo sério — rpc_atribuir_papel,
-- rpc_excluir_pessoa, rpc_exportar_pessoa, rpc_listar_usuarios_papeis — abrem com
-- `IF NOT usuario_tem_papel('GESTAO') THEN RAISE EXCEPTION`, e para o anônimo isso é
-- sempre falso. Isto aqui é endurecimento, não conserto de brecha.
--
-- Vale fazer mesmo assim porque a proteção estava no lugar frágil. Depender de cada
-- função lembrar de se checar é apostar que ninguém vai escrever a próxima sem a
-- verificação — e o custo desse esquecimento seria uma RPC de gestão aberta na
-- internet. Com o EXECUTE revogado, esquecer a checagem deixa de ser fatal.
--
-- Ficam com anon as cinco que precisam, todas verificadas no código:
--   rpc_simulado_publico_iniciar / _submeter  link público de simulado, sem login
--   rpc_email_de_professor_existe             primeiro acesso do professor
--   rpc_resolver_username                     login do aluno: usuário -> e-mail
--   rpc_buscar_alunos_matricula               busca do formulário de autocadastro;
--                                             devolve só id/nome/turma, com LIMIT 8
-- ------------------------------------------------------------------------------------

DO $$
DECLARE
  r record;
  v_publicas constant text[] := ARRAY[
    'rpc_simulado_publico_iniciar',
    'rpc_simulado_publico_submeter',
    'rpc_email_de_professor_existe',
    'rpc_resolver_username',
    'rpc_buscar_alunos_matricula'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_tinha
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname <> ALL (v_publicas)
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      -- Funções de extensão não são nossas para mexer.
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    -- Torna explícito o que `authenticated` já tinha ANTES de revogar de PUBLIC: em
    -- algumas funções o privilégio dele vinha justamente do grant a PUBLIC, e revogar
    -- sem isto tiraria o acesso de quem está logado junto com o do anônimo.
    IF r.auth_tinha THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.assinatura);
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.assinatura);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.assinatura);
  END LOOP;
END $$;

-- Garante as cinco públicas, inclusive se alguma tiver sido criada sem o grant.
GRANT EXECUTE ON FUNCTION public.rpc_simulado_publico_iniciar(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_simulado_publico_submeter(uuid, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_email_de_professor_existe(text) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_resolver_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_buscar_alunos_matricula(text) TO anon;

-- Função nova não nasce mais aberta ao anônimo. Os arquivos SQL deste projeto já
-- costumam terminar com REVOKE/GRANT explícito; isto cobre o dia em que alguém
-- esquecer.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
