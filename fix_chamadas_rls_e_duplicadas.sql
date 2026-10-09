-- (aplicado em produção como migração fix_chamadas_rls_e_duplicadas, 2026-10-09)
-- A tabela chamadas tinha RLS ligado com uma única regra, a de INSERT (modelo padrão do painel): ninguém conseguia
-- LER, APAGAR nem ALTERAR. A chamada gravava, mas a tela não a recarregava, e o "apaga e grava de novo" do app
-- acumulava registros repetidos. Aqui: cópia de segurança, remoção dos repetidos (fica o mais recente) e as regras
-- iguais às de atividades_diárias/vistos_v2.
-- Reversão das regras: drop policy chamadas_* ; restaurar dados: backup_chamadas_20261009.
create table public.backup_chamadas_20261009 as select * from public.chamadas;
alter table public.backup_chamadas_20261009 enable row level security;

delete from public.chamadas c
using (
  select id, row_number() over (
           partition by aluno_id, professor_id, turma_id, disciplina_id, data_aula
           order by created_at desc, id desc) rn
  from public.chamadas
) d
where c.id = d.id and d.rn > 1;

drop policy if exists "Enable insert for authenticated users only" on public.chamadas;
create policy chamadas_select_por_alcance on public.chamadas for select to authenticated
  using (
    (select public.enxerga_escola_inteira())
    or professor_id = (select public.meu_professor_id())
    or turma_id in (select unnest(public.minhas_turmas_de_professor()))
  );
create policy chamadas_insert_servidor on public.chamadas for insert to authenticated
  with check (not (select public.usuario_tem_papel('ALUNO'::papel_usuario)));
create policy chamadas_update_servidor on public.chamadas for update to authenticated
  using (not (select public.usuario_tem_papel('ALUNO'::papel_usuario)))
  with check (not (select public.usuario_tem_papel('ALUNO'::papel_usuario)));
create policy chamadas_delete_servidor on public.chamadas for delete to authenticated
  using (not (select public.usuario_tem_papel('ALUNO'::papel_usuario)));
