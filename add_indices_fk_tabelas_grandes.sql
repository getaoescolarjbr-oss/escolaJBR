-- Índices para chaves estrangeiras das tabelas mais lidas (aviso "unindexed_foreign_keys" do
-- advisor do Supabase). Só as colunas que o app e as políticas RLS realmente filtram, em
-- tabelas com centenas/milhares de linhas — ficaram de fora auditoria(usuario_id) (escrita
-- pesada, leitura rara) e colunas de "corrigido_por"/"id_do_professor" (sem consulta).
-- Custo em disco: ~1 MB no total.
--
-- Reverter: drop index if exists <nome>;  (todos têm prefixo idx_fk_)

create index if not exists idx_fk_alunos_turma_id                 on public.alunos (turma_id);
create index if not exists idx_fk_alunos_pessoa_id                on public.alunos (pessoa_id);
create index if not exists idx_fk_chamadas_turma_id               on public.chamadas (turma_id);
create index if not exists idx_fk_chamadas_aluno_id               on public.chamadas (aluno_id);
create index if not exists idx_fk_chamadas_professor_id           on public.chamadas (professor_id);
create index if not exists idx_fk_chamadas_disciplina_id          on public.chamadas (disciplina_id);
create index if not exists idx_fk_horarios_turma_id               on public.horarios (turma_id);
create index if not exists idx_fk_horarios_professor_id           on public.horarios (professor_id);
create index if not exists idx_fk_atividades_diarias_turma_id     on public."atividades_diárias" (turma_id);
create index if not exists idx_fk_atividades_diarias_professor_id on public."atividades_diárias" (professor_id);
create index if not exists idx_fk_atividades_diarias_disciplina   on public."atividades_diárias" (disciplina_id);
create index if not exists idx_fk_vistos_v2_aluno_id              on public.vistos_v2 (aluno_id);
create index if not exists idx_fk_ocorrencias_aluno_id            on public."ocorrências" (aluno_id);
create index if not exists idx_fk_prova_alocacoes_versao_id       on public.prova_alocacoes (versao_id);
create index if not exists idx_fk_prova_respostas_itens_question  on public.prova_respostas_itens (question_id);
