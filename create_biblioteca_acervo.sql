-- ====================================================================================
-- BIBLIOTECA — Fase 1 (2/8): Acervo (gêneros, coleções, livros, exemplares).
-- ====================================================================================

CREATE TABLE IF NOT EXISTS generos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL UNIQUE,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS colecoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  descricao  TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regra não negociável (direito autoral): todo item do tipo ONLINE tem que ser
-- domínio público com fonte registrada. Aplicado como CHECK, não só como convenção de
-- tela — ninguém consegue inserir um livro ONLINE sem dominio_publico = true, nem
-- marcar dominio_publico = true sem informar de onde veio.
CREATE TABLE IF NOT EXISTS livros (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo                 TEXT NOT NULL,
  autor                  TEXT NOT NULL,
  isbn                   TEXT,
  editora                TEXT,
  ano_publicacao         INTEGER,
  genero_id              UUID REFERENCES generos(id),
  colecao_id             UUID REFERENCES colecoes(id),
  volume                 INTEGER,
  sinopse                TEXT,
  capa_url               TEXT,
  tipo_acervo            TEXT NOT NULL CHECK (tipo_acervo IN ('FISICO', 'ONLINE')),
  dominio_publico         BOOLEAN NOT NULL DEFAULT false,
  fonte_dominio_publico  TEXT,
  arquivo_url            TEXT,
  ativo                  BOOLEAN NOT NULL DEFAULT true,
  criado_por             UUID REFERENCES usuarios(id),
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT livros_online_exige_dominio_publico
    CHECK (tipo_acervo <> 'ONLINE' OR dominio_publico = true),
  CONSTRAINT livros_dominio_publico_exige_fonte
    CHECK (dominio_publico = false OR fonte_dominio_publico IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_livros_genero ON livros (genero_id);
CREATE INDEX IF NOT EXISTS idx_livros_colecao ON livros (colecao_id);
CREATE INDEX IF NOT EXISTS idx_livros_titulo ON livros USING gin (to_tsvector('portuguese', titulo || ' ' || autor));

-- Exemplares só fazem sentido operacionalmente para livros FISICO (livros ONLINE têm
-- acesso simultâneo ilimitado, sem "cópia"). Não bloqueado por CHECK porque a tela de
-- cadastro de exemplar (Fase 2) já só vai oferecer essa opção para livros FISICO — é
-- uma regra de fluxo, não uma invariante que precise travar o banco.
CREATE TABLE IF NOT EXISTS exemplares (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livro_id     UUID NOT NULL REFERENCES livros(id),
  tombo        TEXT NOT NULL UNIQUE,
  estado       TEXT NOT NULL DEFAULT 'Bom' CHECK (estado IN ('Novo', 'Bom', 'Regular', 'Danificado')),
  status       TEXT NOT NULL DEFAULT 'DISPONIVEL' CHECK (status IN ('DISPONIVEL', 'EMPRESTADO', 'RESERVADO', 'BAIXADO')),
  localizacao  TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exemplares_livro ON exemplares (livro_id);

ALTER TABLE generos ENABLE ROW LEVEL SECURITY;
ALTER TABLE generos FORCE ROW LEVEL SECURITY;
ALTER TABLE colecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE colecoes FORCE ROW LEVEL SECURITY;
ALTER TABLE livros ENABLE ROW LEVEL SECURITY;
ALTER TABLE livros FORCE ROW LEVEL SECURITY;
ALTER TABLE exemplares ENABLE ROW LEVEL SECURITY;
ALTER TABLE exemplares FORCE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado da escola (aluno, professor, staff...).
-- Nunca `anon` — o catálogo da Biblioteca não é público na internet (mesma regra de
-- privacidade que vale para o resto do módulo).
DROP POLICY IF EXISTS "generos_select_autenticado" ON generos;
CREATE POLICY "generos_select_autenticado" ON generos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "colecoes_select_autenticado" ON colecoes;
CREATE POLICY "colecoes_select_autenticado" ON colecoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "livros_select_autenticado" ON livros;
CREATE POLICY "livros_select_autenticado" ON livros FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "exemplares_select_autenticado" ON exemplares;
CREATE POLICY "exemplares_select_autenticado" ON exemplares FOR SELECT TO authenticated USING (true);

-- Escrita: só BIBLIOTECA/GESTAO administram o catálogo.
DROP POLICY IF EXISTS "generos_write_biblioteca" ON generos;
CREATE POLICY "generos_write_biblioteca" ON generos FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "colecoes_write_biblioteca" ON colecoes;
CREATE POLICY "colecoes_write_biblioteca" ON colecoes FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "livros_write_biblioteca" ON livros;
CREATE POLICY "livros_write_biblioteca" ON livros FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "exemplares_write_biblioteca" ON exemplares;
CREATE POLICY "exemplares_write_biblioteca" ON exemplares FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP TRIGGER IF EXISTS trg_auditoria_livros ON livros;
CREATE TRIGGER trg_auditoria_livros
  AFTER INSERT OR UPDATE OR DELETE ON livros
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_exemplares ON exemplares;
CREATE TRIGGER trg_auditoria_exemplares
  AFTER INSERT OR UPDATE OR DELETE ON exemplares
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- Buckets de Storage (reaproveitando o padrão de fotos-alunos: público, sem dado
-- sensível). capas-livros guarda imagens de capa; acervo-online guarda os arquivos de
-- domínio público (textos/PDFs). Ambos públicos porque não há confidencialidade em
-- nenhum dos dois — são metadados de catálogo e obras de domínio público.
INSERT INTO storage.buckets (id, name, public)
VALUES ('capas-livros', 'capas-livros', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('acervo-online', 'acervo-online', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "capas_livros_leitura_publica" ON storage.objects;
CREATE POLICY "capas_livros_leitura_publica" ON storage.objects FOR SELECT
  USING (bucket_id = 'capas-livros');

DROP POLICY IF EXISTS "capas_livros_escrita_biblioteca" ON storage.objects;
CREATE POLICY "capas_livros_escrita_biblioteca" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'capas-livros' AND (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO')))
  WITH CHECK (bucket_id = 'capas-livros' AND (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO')));

DROP POLICY IF EXISTS "acervo_online_leitura_publica" ON storage.objects;
CREATE POLICY "acervo_online_leitura_publica" ON storage.objects FOR SELECT
  USING (bucket_id = 'acervo-online');

DROP POLICY IF EXISTS "acervo_online_escrita_biblioteca" ON storage.objects;
CREATE POLICY "acervo_online_escrita_biblioteca" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'acervo-online' AND (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO')))
  WITH CHECK (bucket_id = 'acervo-online' AND (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO')));
