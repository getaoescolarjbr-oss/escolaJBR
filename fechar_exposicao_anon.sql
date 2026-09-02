-- ====================================================================================
-- FECHA O ACESSO ANÔNIMO ÀS TABELAS DO BANCO
--
-- O QUE ESTAVA ABERTO (verificado contra produção com a chave anon pública, em
-- 02/09/2026, por requisições que não alteraram nenhuma linha):
--
--   alunos             506 linhas   SELECT, INSERT, UPDATE, DELETE
--   notas_avaliacoes 16.092 linhas  SELECT, INSERT, UPDATE, DELETE
--   vistos_v2         4.189 linhas  SELECT, INSERT, UPDATE, DELETE
--   avaliacoes          503 linhas  SELECT, INSERT, UPDATE, DELETE
--   atividades_diárias  282 linhas  SELECT, INSERT, UPDATE, DELETE
--   professores          67 linhas  SELECT
--   turmas               13 linhas  SELECT, INSERT, UPDATE, DELETE
--   e ainda disciplinas, recursos, visitas_responsavel, birthday_notifications_log
--
-- Não era só leitura: um DELETE sem filtro em /rest/v1/alunos apagaria os 506 alunos,
-- e um PATCH reescreveria as 16 mil notas. `alunos` inclui cid_codigo/cid_descricao —
-- dado de saúde, a categoria mais protegida da LGPD.
--
-- POR QUE ACONTECEU, para não voltar
--
-- A chave `anon` é pública por natureza: ela viaja no bundle do front e não há como
-- escondê-la. Quem separa "público" de "privado" no Supabase é o GRANT mais o RLS, e
-- aqui os dois estavam abertos: políticas escritas para o papel `public` com
-- USING (true) — que vale para anon —, tabelas com RLS desligada, e o default privilege
-- do Supabase concedendo tudo a anon em cada tabela nova.
--
-- O QUE ESTE ARQUIVO FAZ
--
-- 1. anon perde todo privilégio de tabela e recupera apenas o SELECT das quatro tabelas
--    que a página pública realmente lê. É o GRANT que decide primeiro: sem ele, a
--    política nem chega a ser avaliada.
-- 2. As políticas de papel `public` viram `authenticated`. Redundante hoje, proposital
--    para amanhã: se um GRANT a anon voltar por descuido, a porta continua fechada.
-- 3. RLS é ligada onde estava desligada, com política que preserva exatamente o acesso
--    atual de quem está logado — nenhuma tela muda de comportamento.
-- 4. O default privilege deixa de conceder tabelas novas a anon. Sem isto, a próxima
--    tabela criada nasce aberta de novo.
-- 5. A leitura anônima de `professores` (que despejava os 67 e-mails) é trocada por uma
--    RPC que responde só sim/não para um e-mail — o suficiente para a tela de primeiro
--    acesso, sem entregar a lista.
--
-- O QUE ESTE ARQUIVO NÃO FAZ
--
-- Não restringe um professor a ver só as próprias turmas: quem está logado continua
-- enxergando o que enxergava. Isso é um trabalho à parte, com risco real de quebrar
-- telas, e misturá-lo aqui atrasaria o fechamento do que está aberto para a internet.
-- Duas coisas para essa próxima etapa, já mapeadas:
--   * professores tem "Atualização de professores" [authenticated] USING (true) — hoje
--     qualquer conta logada, inclusive de aluno, pode reescrever a ficha de um servidor;
--   * 300 funções são executáveis por anon (default do Supabase). A maioria é função de
--     gatilho, inofensiva por não ter contexto fora do trigger, mas a lista merece uma
--     passada.
-- ====================================================================================


-- ------------------------------------------------------------------------------------
-- 1. anon: tudo revogado, e só o público de verdade devolvido
--
-- As quatro tabelas abaixo são as que LandingPage.tsx lê sem sessão. A página pública de
-- simulado não precisa de nenhuma: ela conversa só por RPCs SECURITY DEFINER, que rodam
-- como dono e não dependem de GRANT de tabela. O autocadastro do BiblioClube também não
-- entra aqui — o signUp cria a sessão antes de qualquer escrita, então ele é
-- authenticated.
-- ------------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

GRANT SELECT ON public.landing_avisos    TO anon;
GRANT SELECT ON public.landing_eventos   TO anon;
GRANT SELECT ON public.landing_noticias  TO anon;
GRANT SELECT ON public.calendario_eventos TO anon;

-- Tabela nova não nasce mais aberta.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;


-- ------------------------------------------------------------------------------------
-- 2. Políticas de `public` viram `authenticated`
--
-- No Postgres o papel `public` é "todo mundo", anon incluído. Recriar cada uma com
-- TO authenticated mantém o comportamento de quem está logado e tira anon da conta.
-- ------------------------------------------------------------------------------------

-- alunos: era leitura, inserção, alteração e exclusão para qualquer um.
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.alunos;
DROP POLICY IF EXISTS "Allow insert alunos" ON public.alunos;
DROP POLICY IF EXISTS "Allow update alunos" ON public.alunos;
DROP POLICY IF EXISTS "Allow delete alunos" ON public.alunos;

CREATE POLICY "alunos_select_autenticado" ON public.alunos
  FOR SELECT TO authenticated USING (true);
-- A escrita é liberada a "qualquer conta que não seja de aluno", e não a uma lista de
-- papéis. A lista seria mais bonita e mais frágil: escrevem em alunos o painel de
-- gestão, o painel da coordenação, a ficha do aluno e utils/studentUtils, cada um
-- alcançável por um papel diferente — esquecer um deles quebraria a tela em produção
-- sem aviso. O que precisa sair daqui é o aluno (e o anônimo, já resolvido pelo GRANT);
-- afinar por papel é trabalho da próxima etapa, com as telas na mão.
CREATE POLICY "alunos_insert_servidor" ON public.alunos
  FOR INSERT TO authenticated WITH CHECK (NOT public.usuario_tem_papel('ALUNO'));
CREATE POLICY "alunos_update_servidor" ON public.alunos
  FOR UPDATE TO authenticated
  USING (NOT public.usuario_tem_papel('ALUNO'))
  WITH CHECK (NOT public.usuario_tem_papel('ALUNO'));

-- Excluir é a exceção que vale apertar agora: só o painel de gestão apaga aluno, e a
-- exclusão leva notas e vistos junto por cascata.
CREATE POLICY "alunos_delete_gestao" ON public.alunos
  FOR DELETE TO authenticated USING (
    public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO')
  );

-- notas_avaliacoes: sobra a política de authenticated que já existia.
DROP POLICY IF EXISTS "Professores podem gerenciar as notas de suas avaliações" ON public.notas_avaliacoes;

-- avaliacoes (as de nota, do GradesPanel): idem.
DROP POLICY IF EXISTS "Professores podem gerenciar suas avaliações" ON public.avaliacoes;

-- turmas: "Permitir tudo para anon" fazia jus ao nome.
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.turmas;
DROP POLICY IF EXISTS "Permitir tudo para anon" ON public.turmas;

CREATE POLICY "turmas_select_autenticado" ON public.turmas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "turmas_escrita_servidor" ON public.turmas
  FOR ALL TO authenticated
  USING (NOT public.usuario_tem_papel('ALUNO'))
  WITH CHECK (NOT public.usuario_tem_papel('ALUNO'));

-- visitas_responsavel: "Allow all" para todos.
DROP POLICY IF EXISTS "Allow all" ON public.visitas_responsavel;
CREATE POLICY "visitas_responsavel_autenticado" ON public.visitas_responsavel
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- recursos: a leitura era "pública" mesmo sem necessidade — a agenda exige login. As de
-- escrita já pediam papel, então o anônimo nunca passou por elas; recriar em
-- `authenticated` é para o mesmo fim das demais: se um GRANT voltar por engano, a
-- política não é a que vai ceder. As expressões são copiadas sem alteração.
DROP POLICY IF EXISTS "recursos_select_publico" ON public.recursos;
CREATE POLICY "recursos_select_autenticado" ON public.recursos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recursos_write_coordenacao_gestao_pcpi" ON public.recursos;
CREATE POLICY "recursos_write_coordenacao_gestao_pcpi" ON public.recursos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

DROP POLICY IF EXISTS "recursos_update_coordenacao_gestao_pcpi" ON public.recursos;
CREATE POLICY "recursos_update_coordenacao_gestao_pcpi" ON public.recursos
  FOR UPDATE TO authenticated
  USING (
    public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  )
  WITH CHECK (
    public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

DROP POLICY IF EXISTS "recursos_delete_coordenacao_gestao_pcpi" ON public.recursos;
CREATE POLICY "recursos_delete_coordenacao_gestao_pcpi" ON public.recursos
  FOR DELETE TO authenticated
  USING (
    public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO')
    OR public.usuario_tem_papel('PCPI')
  );

-- birthday_notifications_log: a política se chamava "Service role full access" mas
-- estava no papel public. service_role ignora RLS, então não precisa de política
-- nenhuma — basta não deixar a porta aberta para os outros.
DROP POLICY IF EXISTS "Service role full access" ON public.birthday_notifications_log;


-- ------------------------------------------------------------------------------------
-- 3. RLS ligada onde estava desligada
--
-- Com RLS desligada, a tabela responde a quem tiver GRANT — foi assim que vistos_v2 e
-- atividades_diárias ficaram abertas. As políticas abaixo repetem o acesso que quem está
-- logado já tinha, então nenhuma tela muda; o ganho é a tabela deixar de depender só do
-- GRANT para se proteger.
-- ------------------------------------------------------------------------------------
ALTER TABLE public.vistos_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vistos_v2_autenticado" ON public.vistos_v2;
CREATE POLICY "vistos_v2_autenticado" ON public.vistos_v2
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."atividades_diárias" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "atividades_diarias_autenticado" ON public."atividades_diárias";
CREATE POLICY "atividades_diarias_autenticado" ON public."atividades_diárias"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

-- disciplinas é catálogo (34 linhas, sem dado pessoal). Leitura para qualquer conta
-- logada; escrita para servidor.
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disciplinas_select_autenticado" ON public.disciplinas;
CREATE POLICY "disciplinas_select_autenticado" ON public.disciplinas
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "disciplinas_escrita_servidor" ON public.disciplinas;
CREATE POLICY "disciplinas_escrita_servidor" ON public.disciplinas
  FOR ALL TO authenticated
  USING (NOT public.usuario_tem_papel('ALUNO'))
  WITH CHECK (NOT public.usuario_tem_papel('ALUNO'));


-- ------------------------------------------------------------------------------------
-- 4. Primeiro acesso do professor sem despejar a lista de e-mails
--
-- Login.tsx perguntava "existe professor com este e-mail?" com um SELECT direto, o que
-- exigia leitura anônima da tabela inteira — e entregava os 67 e-mails a quem pedisse.
-- A RPC responde só sim ou não.
--
-- Ela confirma existência de e-mail, então permite descobrir se um endereço é de
-- professor da escola. É o mínimo que a tela precisa para dizer "e-mail não encontrado
-- na base de professores", que é a mensagem que ela já mostrava.
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura de professores" ON public.professores;

-- Para quem está logado, a leitura continua: o app lista professores em várias telas.
DROP POLICY IF EXISTS "professores_select_autenticado" ON public.professores;
CREATE POLICY "professores_select_autenticado" ON public.professores
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.rpc_email_de_professor_existe(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM professores WHERE lower(email) = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_email_de_professor_existe(text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_email_de_professor_existe(text) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_email_de_professor_existe(text) TO authenticated;
