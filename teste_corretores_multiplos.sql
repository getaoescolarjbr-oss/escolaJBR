-- Teste (a transação termina em exceção de propósito, então nada fica gravado).
-- Rodar JUNTO com add_corretores_multiplos_redacao.sql, na mesma requisição, para testar antes de aplicar.
do $t$
declare
  ana  constant uuid := 'fa4d7516-fc5f-4b60-b30c-dc5e7a40ed46';  -- PROFESSOR (Ana Cristina)
  andr constant uuid := '4b7111f8-e51b-4701-9600-7d27b1d3b497';  -- PROFESSOR (Andre)
  bru  constant uuid := 'ee5ea465-af36-45d1-b4e3-46aa6522ddbf';  -- PROFESSOR sem cota (Bruno)
  dono constant uuid := '9f61f632-78d8-44b2-8fb3-8b84eb5589cb';  -- criador da prova (gestor)
  p_ana constant uuid := '4615fa3e-a95d-4cf4-b652-52dfe05cbf5a';
  p_and constant uuid := 'ec23d437-60cb-4c80-8a36-1c0a1bb02e54';
  qid  constant uuid := '6243c549-fbbb-4b3a-ac83-6b019db1f021';
  v_turma uuid; v_prova uuid; a1 uuid; a2 uuid; a3 uuid; a4 uuid; v_envio uuid; r jsonb := '[]'::jsonb; x text; j jsonb;
begin
  r := '{}'::jsonb;
  insert into turmas(nome, nivel) values ('ZZ TESTE ROLLBACK', 'Médio') returning id into v_turma;
  insert into alunos(nome, turma_id, aluno_numero, status) values ('Aluno 1', v_turma, 1, 'Ativo') returning id into a1;
  insert into alunos(nome, turma_id, aluno_numero, status) values ('Aluno 2', v_turma, 2, 'Ativo') returning id into a2;
  insert into alunos(nome, turma_id, aluno_numero, status) values ('Aluno 3', v_turma, 3, 'Ativo') returning id into a3;
  insert into alunos(nome, turma_id, aluno_numero, status) values ('Aluno 4', v_turma, 4, 'Ativo') returning id into a4;
  insert into provas(titulo, disciplina, valor_total, modo, status, criado_por, tipo, qtd_versoes, modo_nota, lancar_no_boletim, folha_redacao, eh_prova_area, eh_prova_geral)
    values ('ZZ TESTE', 'Português', 10, 'IMPRESSA', 'PUBLICADA', dono, 'AVALIACAO', 1, 'DIRETA', false, true, true, false) returning id into v_prova;
  insert into prova_turmas(prova_id, turma_id) values (v_prova, v_turma);
  insert into prova_questoes(prova_id, question_id, ordem, valor) values (v_prova, qid, 1, 10);
  insert into prova_area_cotas(prova_id, professor_id, qtd_questoes) values (v_prova, p_ana, 1), (v_prova, p_and, 1);

  -- 1. dois corretores na mesma turma (antes violava uq_prova_corretor_turma); repetir o mesmo deve falhar
  insert into prova_corretores(prova_id, turma_id, professor_id) values (v_prova, v_turma, p_ana), (v_prova, v_turma, p_and);
  begin
    insert into prova_corretores(prova_id, turma_id, professor_id) values (v_prova, v_turma, p_ana);
    x := 'ERRO: duplicado aceito';
  exception when unique_violation then x := 'ok (duplicado recusado)'; end;
  r := r || jsonb_build_object('1_dois_corretores_e_duplicado', x);

  create or replace function pg_temp.eu(u uuid) returns void language plpgsql as $f$
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u::text, true);
  end $f$;
  create or replace function pg_temp.tenta(s text) returns text language plpgsql as $f$
  begin execute s; return 'ok'; exception when others then return sqlerrm; end $f$;

  -- 2. Ana assume o aluno 1; Andre não consegue
  perform pg_temp.eu(ana);
  r := r || jsonb_build_object('2a_ana_assume', (select public.rpc_redacao_assumir(v_prova, a1, qid)));
  perform pg_temp.eu(andr);
  r := r || jsonb_build_object('2b_andre_tenta_assumir', pg_temp.tenta(format('select public.rpc_redacao_assumir(%L,%L,%L)', v_prova, a1, qid)));

  -- 3. Ana abre e salva; Andre não grava (salvar, confirmar, rubrica, mostrar_esperado, abrir) mas LÊ
  perform pg_temp.eu(ana);
  v_envio := (public.rpc_redacao_preparar_aluno(v_prova, a1, qid) ->> 'envio_id')::uuid;
  r := r || jsonb_build_object('3a_ana_salva', pg_temp.tenta(format('select public.rpc_redacao_salvar(%L, null, null, %L, null)', v_envio, 'texto da ana')));
  perform pg_temp.eu(andr);
  r := r || jsonb_build_object('3b_andre_salva', pg_temp.tenta(format('select public.rpc_redacao_salvar(%L, null, null, %L, null)', v_envio, 'texto do andre')));
  r := r || jsonb_build_object('3c_andre_confirma', pg_temp.tenta(format('select public.rpc_redacao_confirmar(%L, %L::jsonb, null)', v_envio, '{}')));
  r := r || jsonb_build_object('3d_andre_rubrica', pg_temp.tenta(format('select public.rpc_redacao_definir_rubrica(%L, null)', v_envio)));
  r := r || jsonb_build_object('3e_andre_mostrar', pg_temp.tenta(format('select public.rpc_redacao_mostrar_esperado(%L, true)', v_envio)));
  r := r || jsonb_build_object('3f_andre_abre', pg_temp.tenta(format('select public.rpc_redacao_preparar_aluno(%L,%L,%L)', v_prova, a1, qid)));
  r := r || jsonb_build_object('3g_andre_le', pg_temp.tenta(format('select public.rpc_redacao_obter(%L)', v_envio)));

  -- 4. Bruno (sem cota, sem corretor) não tem acesso
  perform pg_temp.eu(bru);
  r := r || jsonb_build_object('4_bruno_lista', pg_temp.tenta(format('select * from public.rpc_redacao_listar(%L)', v_prova)));

  -- 5. dono divide: sem refazer atribui só as 3 sem responsável; com refazer, 2 e 2
  perform pg_temp.eu(dono);
  r := r || jsonb_build_object('5a_dividir', public.rpc_redacao_dividir(v_prova, false));
  r := r || jsonb_build_object('5b_aluno1_continua_com', (select pr.nome from redacao_atribuicoes a join professores pr on pr.id = a.professor_id where a.prova_id = v_prova and a.aluno_id = a1));
  r := r || jsonb_build_object('5c_distribuicao', (select jsonb_object_agg(pr.nome, n) from (select professor_id, count(*) n from redacao_atribuicoes where prova_id = v_prova group by 1) s join professores pr on pr.id = s.professor_id));
  r := r || jsonb_build_object('5d_refazer', public.rpc_redacao_dividir(v_prova, true));
  r := r || jsonb_build_object('5e_distribuicao_refazer', (select jsonb_object_agg(pr.nome, n) from (select professor_id, count(*) n from redacao_atribuicoes where prova_id = v_prova group by 1) s join professores pr on pr.id = s.professor_id));
  perform pg_temp.eu(andr);
  r := r || jsonb_build_object('5f_andre_nao_divide', pg_temp.tenta(format('select public.rpc_redacao_dividir(%L, false)', v_prova)));

  -- 6. listar como Andre
  select jsonb_agg(jsonb_build_object('aluno', aluno_nome, 'resp', responsavel_nome, 'meu', sou_responsavel, 'bloqueado', bloqueio is not null, 'gestor', sou_gestor) order by numero_chamada)
    into j from public.rpc_redacao_listar(v_prova);
  r := r || jsonb_build_object('6_listar_como_andre', j);

  -- 7. liberar
  select a.aluno_id into a1 from redacao_atribuicoes a where a.prova_id = v_prova and a.professor_id = p_ana limit 1;
  r := r || jsonb_build_object('7a_andre_libera_da_ana', pg_temp.tenta(format('select public.rpc_redacao_liberar(%L,%L,%L)', v_prova, a1, qid)));
  perform pg_temp.eu(ana);
  r := r || jsonb_build_object('7b_ana_libera_a_sua', pg_temp.tenta(format('select public.rpc_redacao_liberar(%L,%L,%L)', v_prova, a1, qid)));
  perform pg_temp.eu(andr);
  r := r || jsonb_build_object('7c_andre_assume_liberada', pg_temp.tenta(format('select public.rpc_redacao_assumir(%L,%L,%L)', v_prova, a1, qid)));

  -- 8. dono tem passe livre; rpc_notas_bloqueadas continua funcionando
  perform pg_temp.eu(dono);
  r := r || jsonb_build_object('8a_dono_salva_em_qualquer', pg_temp.tenta(format('select public.rpc_redacao_salvar(%L, null, null, %L, null)', v_envio, 'texto do dono')));
  r := r || jsonb_build_object('8b_notas_bloqueadas', pg_temp.tenta('select * from public.rpc_notas_bloqueadas(array[]::uuid[])'));

  -- 9. turma SEM corretor: professor com cota continua corrigindo como antes
  delete from prova_corretores where prova_id = v_prova;
  delete from redacao_atribuicoes where prova_id = v_prova;
  perform pg_temp.eu(andr);
  r := r || jsonb_build_object('9_sem_corretor_andre_salva', pg_temp.tenta(format('select public.rpc_redacao_salvar(%L, null, null, %L, null)', v_envio, 'texto livre')));

  raise exception 'RESULTADO %', jsonb_pretty(r);
end
$t$;
