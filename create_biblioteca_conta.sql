-- ====================================================================================
-- BIBLIOTECA — Fase 1 (8/8): Conta/conteúdo (avisos, notícias, frases) + perfil do
-- aluno como extensão da tabela `alunos` já existente (não criamos uma tabela paralela
-- de "perfil" — mesmo princípio não-destrutivo usado em toda a Fundação: ALTER TABLE
-- ADD COLUMN, nunca uma nova entidade concorrente).
-- ====================================================================================

ALTER TABLE alunos ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS tema_cor TEXT;
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS genero_favorito_id UUID REFERENCES generos(id);
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS perfil_publico BOOLEAN NOT NULL DEFAULT false;

-- "Perfil público" só controla visibilidade DENTRO da comunidade autenticada da escola
-- (outros alunos/professores verem estatísticas/avatar) — nunca visibilidade para a
-- internet, que já é impedida pela ausência de qualquer policy `anon` neste módulo.
-- "Meu Cartão" (carteirinha digital) não precisa de coluna nova: usa o próprio
-- `alunos.id` como identificador/QR — nenhuma informação adicional a manter em sync.

CREATE TABLE IF NOT EXISTS avisos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id   UUID REFERENCES alunos(id), -- NULL = aviso geral (para todos os alunos)
  tipo       TEXT NOT NULL DEFAULT 'GERAL',
  titulo     TEXT NOT NULL,
  corpo      TEXT,
  lida       BOOLEAN NOT NULL DEFAULT false,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS noticias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         TEXT NOT NULL,
  corpo          TEXT NOT NULL,
  autor          TEXT,
  publicado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ativo          BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS frases (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  texto  TEXT NOT NULL,
  autor  TEXT,
  ativo  BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos FORCE ROW LEVEL SECURITY;
ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;
ALTER TABLE noticias FORCE ROW LEVEL SECURITY;
ALTER TABLE frases ENABLE ROW LEVEL SECURITY;
ALTER TABLE frases FORCE ROW LEVEL SECURITY;

-- avisos: aluno vê os seus + os gerais (aluno_id IS NULL); só ele marca como lido.
DROP POLICY IF EXISTS "avisos_select" ON avisos;
CREATE POLICY "avisos_select" ON avisos FOR SELECT TO authenticated
  USING (aluno_id IS NULL OR aluno_id = public.meu_aluno_id()
         OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "avisos_update_proprio" ON avisos;
CREATE POLICY "avisos_update_proprio" ON avisos FOR UPDATE TO authenticated
  USING (aluno_id = public.meu_aluno_id())
  WITH CHECK (aluno_id = public.meu_aluno_id());

DROP POLICY IF EXISTS "avisos_write_biblioteca" ON avisos;
CREATE POLICY "avisos_write_biblioteca" ON avisos FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "avisos_delete_biblioteca" ON avisos;
CREATE POLICY "avisos_delete_biblioteca" ON avisos FOR DELETE TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "noticias_select_autenticado" ON noticias;
CREATE POLICY "noticias_select_autenticado" ON noticias FOR SELECT TO authenticated USING (ativo = true OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "noticias_write_biblioteca" ON noticias;
CREATE POLICY "noticias_write_biblioteca" ON noticias FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "frases_select_autenticado" ON frases;
CREATE POLICY "frases_select_autenticado" ON frases FOR SELECT TO authenticated USING (ativo = true OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "frases_write_biblioteca" ON frases;
CREATE POLICY "frases_write_biblioteca" ON frases FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP TRIGGER IF EXISTS trg_auditoria_avisos ON avisos;
CREATE TRIGGER trg_auditoria_avisos
  AFTER INSERT OR UPDATE OR DELETE ON avisos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
