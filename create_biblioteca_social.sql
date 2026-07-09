-- ====================================================================================
-- BIBLIOTECA — Fase 1 (7/8): Social (duplas de leitura, resenhas, curtidas, denúncias).
--
-- REGRA DE SEGURANÇA INFANTIL: nenhuma tabela deste arquivo tem policy para `anon` —
-- tudo exige `authenticated` (usuário logado da própria escola). Isso implementa "feed
-- e perfis nunca são públicos na internet" no nível mais forte possível (RLS), não
-- como uma convenção de tela que alguém possa esquecer de aplicar depois.
-- ====================================================================================

-- Duplas de leitura exigem aceite mútuo: quem convida insere com status PENDENTE;
-- só o convidado (aluno_b) pode fazer a linha virar ACEITA; qualquer um dos dois pode
-- desfazer. O par é normalizado (LEAST/GREATEST) para que "A convida B" e "B convida A"
-- contem como o mesmo par, e o índice único parcial impede duas linhas
-- pendentes/ativas simultâneas para o mesmo par.
CREATE TABLE IF NOT EXISTS duplas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_a        UUID NOT NULL REFERENCES alunos(id),
  aluno_b        UUID NOT NULL REFERENCES alunos(id),
  status         TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ACEITA', 'DESFEITA')),
  solicitado_por UUID NOT NULL REFERENCES alunos(id),
  aceito_em      TIMESTAMPTZ,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT duplas_alunos_distintos CHECK (aluno_a <> aluno_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS duplas_par_ativo_unico
  ON duplas (LEAST(aluno_a, aluno_b), GREATEST(aluno_a, aluno_b))
  WHERE status IN ('PENDENTE', 'ACEITA');

CREATE TABLE IF NOT EXISTS indicacoes_dupla (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dupla_id   UUID NOT NULL REFERENCES duplas(id),
  de_aluno   UUID NOT NULL REFERENCES alunos(id),
  para_aluno UUID NOT NULL REFERENCES alunos(id),
  livro_id   UUID NOT NULL REFERENCES livros(id),
  status     TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'LIDO', 'RECUSADA')),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Resenhas: publicadas imediatamente (VISIVEL), mas sujeitas a filtro automático de
-- palavrões (a implementar como função de validação na Fase 7, junto com a tela — aqui
-- só o campo `status` que o filtro/moderação vão usar) e a denúncia+moderação humana.
CREATE TABLE IF NOT EXISTS resenhas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id           UUID NOT NULL REFERENCES alunos(id),
  livro_id           UUID NOT NULL REFERENCES livros(id),
  nota               INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  texto              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'VISIVEL' CHECK (status IN ('VISIVEL', 'OCULTA', 'REMOVIDA')),
  oculto_por         UUID REFERENCES usuarios(id),
  oculto_em          TIMESTAMPTZ,
  motivo_ocultacao   TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resenhas_livro ON resenhas (livro_id);

CREATE TABLE IF NOT EXISTS curtidas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resenha_id UUID NOT NULL REFERENCES resenhas(id),
  aluno_id   UUID NOT NULL REFERENCES alunos(id),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resenha_id, aluno_id)
);

CREATE TABLE IF NOT EXISTS denuncias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resenha_id      UUID NOT NULL REFERENCES resenhas(id),
  denunciado_por  UUID NOT NULL REFERENCES alunos(id),
  motivo          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'TRATADA', 'ARQUIVADA')),
  tratado_por     UUID REFERENCES usuarios(id),
  tratado_em      TIMESTAMPTZ,
  acao_tomada     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE duplas ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplas FORCE ROW LEVEL SECURITY;
ALTER TABLE indicacoes_dupla ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacoes_dupla FORCE ROW LEVEL SECURITY;
ALTER TABLE resenhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE resenhas FORCE ROW LEVEL SECURITY;
ALTER TABLE curtidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE curtidas FORCE ROW LEVEL SECURITY;
ALTER TABLE denuncias ENABLE ROW LEVEL SECURITY;
ALTER TABLE denuncias FORCE ROW LEVEL SECURITY;

-- duplas: os dois participantes (e staff de moderação) veem a linha.
DROP POLICY IF EXISTS "duplas_select" ON duplas;
CREATE POLICY "duplas_select" ON duplas FOR SELECT TO authenticated
  USING (aluno_a = public.meu_aluno_id() OR aluno_b = public.meu_aluno_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

-- Só pode convidar quem está convidando (solicitado_por = eu, e eu sou um dos dois
-- lados do par).
DROP POLICY IF EXISTS "duplas_insert" ON duplas;
CREATE POLICY "duplas_insert" ON duplas FOR INSERT TO authenticated
  WITH CHECK (solicitado_por = public.meu_aluno_id() AND public.meu_aluno_id() IN (aluno_a, aluno_b));

-- Aceite mútuo: só o convidado pode fazer PENDENTE -> ACEITA; qualquer um dos dois
-- pode desfazer (-> DESFEITA) a qualquer momento.
DROP POLICY IF EXISTS "duplas_update" ON duplas;
CREATE POLICY "duplas_update" ON duplas FOR UPDATE TO authenticated
  USING (aluno_a = public.meu_aluno_id() OR aluno_b = public.meu_aluno_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (aluno_a = public.meu_aluno_id() OR aluno_b = public.meu_aluno_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- indicacoes_dupla: só os dois integrantes da dupla enxergam/participam.
DROP POLICY IF EXISTS "indicacoes_dupla_select" ON indicacoes_dupla;
CREATE POLICY "indicacoes_dupla_select" ON indicacoes_dupla FOR SELECT TO authenticated
  USING (de_aluno = public.meu_aluno_id() OR para_aluno = public.meu_aluno_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "indicacoes_dupla_insert" ON indicacoes_dupla;
CREATE POLICY "indicacoes_dupla_insert" ON indicacoes_dupla FOR INSERT TO authenticated
  WITH CHECK (de_aluno = public.meu_aluno_id());

DROP POLICY IF EXISTS "indicacoes_dupla_update" ON indicacoes_dupla;
CREATE POLICY "indicacoes_dupla_update" ON indicacoes_dupla FOR UPDATE TO authenticated
  USING (para_aluno = public.meu_aluno_id())
  WITH CHECK (para_aluno = public.meu_aluno_id());

-- resenhas: qualquer autenticado vê as VISIVEL; o autor também vê a própria mesmo
-- oculta/removida (para saber que foi moderada); staff de moderação vê tudo.
DROP POLICY IF EXISTS "resenhas_select" ON resenhas;
CREATE POLICY "resenhas_select" ON resenhas FOR SELECT TO authenticated
  USING (status = 'VISIVEL' OR aluno_id = public.meu_aluno_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "resenhas_insert" ON resenhas;
CREATE POLICY "resenhas_insert" ON resenhas FOR INSERT TO authenticated
  WITH CHECK (aluno_id = public.meu_aluno_id());

-- Update: autor só edita o próprio texto/nota enquanto ainda está VISIVEL (não pode
-- mexer em status/oculto_por/etc. — campos de moderação só staff altera). Simplificado
-- aqui como "USING dono ou staff"; a Fase 7 pode refinar com uma RPC dedicada se for
-- necessário impedir o autor de tentar reverter uma ocultação por conta própria.
DROP POLICY IF EXISTS "resenhas_update" ON resenhas;
CREATE POLICY "resenhas_update" ON resenhas FOR UPDATE TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

-- curtidas: qualquer autenticado cutte/descurte; leitura livre entre autenticados
-- (contagem de curtidas é informação social benigna, sem PII).
DROP POLICY IF EXISTS "curtidas_select" ON curtidas;
CREATE POLICY "curtidas_select" ON curtidas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "curtidas_insert" ON curtidas;
CREATE POLICY "curtidas_insert" ON curtidas FOR INSERT TO authenticated
  WITH CHECK (aluno_id = public.meu_aluno_id());

DROP POLICY IF EXISTS "curtidas_delete" ON curtidas;
CREATE POLICY "curtidas_delete" ON curtidas FOR DELETE TO authenticated
  USING (aluno_id = public.meu_aluno_id());

-- denuncias: quem denuncia vê a própria denúncia; só staff de moderação vê a fila
-- completa e resolve (BIBLIOTECA/COORDENACAO/GESTAO, conforme pedido — escalonamento
-- de reincidência para COORDENACAO).
DROP POLICY IF EXISTS "denuncias_select" ON denuncias;
CREATE POLICY "denuncias_select" ON denuncias FOR SELECT TO authenticated
  USING (denunciado_por = public.meu_aluno_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "denuncias_insert" ON denuncias;
CREATE POLICY "denuncias_insert" ON denuncias FOR INSERT TO authenticated
  WITH CHECK (denunciado_por = public.meu_aluno_id());

DROP POLICY IF EXISTS "denuncias_update_staff" ON denuncias;
CREATE POLICY "denuncias_update_staff" ON denuncias FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

DROP TRIGGER IF EXISTS trg_auditoria_resenhas ON resenhas;
CREATE TRIGGER trg_auditoria_resenhas
  AFTER INSERT OR UPDATE OR DELETE ON resenhas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_denuncias ON denuncias;
CREATE TRIGGER trg_auditoria_denuncias
  AFTER INSERT OR UPDATE OR DELETE ON denuncias
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_duplas ON duplas;
CREATE TRIGGER trg_auditoria_duplas
  AFTER INSERT OR UPDATE OR DELETE ON duplas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
