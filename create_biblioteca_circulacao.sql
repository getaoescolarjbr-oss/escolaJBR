-- ====================================================================================
-- BIBLIOTECA — Fase 1 (3/8): Circulação (empréstimos, reservas de título, favoritos,
-- indicações de compra).
--
-- REGRA ATÔMICA #1 (empréstimo único por exemplar): diferente do Agendamento (que
-- precisou de EXCLUDE USING gist para intervalos de tempo que se sobrepõem), aqui o
-- problema é mais simples — "no máximo 1 linha com status ATIVO por exemplar_id", sem
-- noção de intervalo. Isso é exatamente o que um ÍNDICE ÚNICO PARCIAL resolve, sem
-- precisar da extensão btree_gist: o Postgres garante atomicidade na hora do INSERT,
-- então duas tentativas concorrentes de emprestar o mesmo exemplar nunca conseguem
-- coexistir — a segunda falha com erro de unicidade (código 23505).
-- ====================================================================================

CREATE TABLE IF NOT EXISTS emprestimos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exemplar_id    UUID NOT NULL REFERENCES exemplares(id),
  aluno_id       UUID NOT NULL REFERENCES alunos(id),
  data_emprestimo DATE NOT NULL DEFAULT current_date,
  data_prevista  DATE NOT NULL,
  data_devolucao DATE,
  status         TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'DEVOLVIDO', 'ATRASADO')),
  renovacoes     INTEGER NOT NULL DEFAULT 0,
  criado_por     UUID REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A regra atômica de verdade está aqui — não em nenhuma checagem feita pela tela.
CREATE UNIQUE INDEX IF NOT EXISTS emprestimos_exemplar_ativo_unico
  ON emprestimos (exemplar_id) WHERE status = 'ATIVO';

CREATE INDEX IF NOT EXISTS idx_emprestimos_aluno ON emprestimos (aluno_id);
CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos (status);

-- Mantém exemplares.status em sincronia com o empréstimo (conveniência de leitura —
-- quem garante a regra de negócio é o índice único acima, não este trigger).
CREATE OR REPLACE FUNCTION public.fn_emprestimo_sincroniza_exemplar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'ATIVO' THEN
    UPDATE exemplares SET status = 'EMPRESTADO' WHERE id = NEW.exemplar_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'DEVOLVIDO' AND OLD.status <> 'DEVOLVIDO' THEN
    UPDATE exemplares SET status = 'DISPONIVEL' WHERE id = NEW.exemplar_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emprestimo_sincroniza_exemplar ON emprestimos;
CREATE TRIGGER trg_emprestimo_sincroniza_exemplar
  AFTER INSERT OR UPDATE ON emprestimos
  FOR EACH ROW EXECUTE FUNCTION public.fn_emprestimo_sincroniza_exemplar();

-- Reserva de TÍTULO (não de exemplar específico) — fila de espera para quando não há
-- cópia disponível. A regra "bloquear renovação se houver reserva de outro aluno" e a
-- lógica de atendimento automático da fila ficam para a Fase 3 (RPCs de circulação);
-- aqui só o formato de dados.
CREATE TABLE IF NOT EXISTS reservas_livro (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livro_id   UUID NOT NULL REFERENCES livros(id),
  aluno_id   UUID NOT NULL REFERENCES alunos(id),
  data       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status     TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'ATENDIDA', 'CANCELADA', 'EXPIRADA')),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No máximo uma reserva ativa por aluno para o mesmo título.
CREATE UNIQUE INDEX IF NOT EXISTS reservas_livro_ativa_unica
  ON reservas_livro (livro_id, aluno_id) WHERE status = 'ATIVA';

CREATE TABLE IF NOT EXISTS favoritos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id   UUID NOT NULL REFERENCES alunos(id),
  livro_id   UUID NOT NULL REFERENCES livros(id),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, livro_id)
);

CREATE TABLE IF NOT EXISTS indicacoes_compra (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id            UUID NOT NULL REFERENCES alunos(id),
  titulo              TEXT NOT NULL,
  autor               TEXT,
  status              TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ANALISE', 'COMPRADO', 'RECUSADO')),
  observacao_biblioteca TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos FORCE ROW LEVEL SECURITY;
ALTER TABLE reservas_livro ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas_livro FORCE ROW LEVEL SECURITY;
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE favoritos FORCE ROW LEVEL SECURITY;
ALTER TABLE indicacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacoes_compra FORCE ROW LEVEL SECURITY;

-- emprestimos: aluno vê só os seus; staff vê e administra tudo. Sem INSERT/UPDATE para
-- o aluno em linha direta — empréstimo é lançado pela BIBLIOTECA no balcão, e a
-- renovação (que tem regras de negócio: limite, atraso, fila) vai por RPC dedicada na
-- Fase 3, não por UPDATE direto do aluno na tabela.
DROP POLICY IF EXISTS "emprestimos_select" ON emprestimos;
CREATE POLICY "emprestimos_select" ON emprestimos FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

DROP POLICY IF EXISTS "emprestimos_write_biblioteca" ON emprestimos;
CREATE POLICY "emprestimos_write_biblioteca" ON emprestimos FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- reservas_livro: aluno cria/cancela a própria; staff vê/administra tudo.
DROP POLICY IF EXISTS "reservas_livro_select" ON reservas_livro;
CREATE POLICY "reservas_livro_select" ON reservas_livro FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "reservas_livro_insert" ON reservas_livro;
CREATE POLICY "reservas_livro_insert" ON reservas_livro FOR INSERT TO authenticated
  WITH CHECK (aluno_id = public.meu_aluno_id());

DROP POLICY IF EXISTS "reservas_livro_update" ON reservas_livro;
CREATE POLICY "reservas_livro_update" ON reservas_livro FOR UPDATE TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- favoritos: só o próprio aluno lê/escreve os seus (não é dado público, mas também não
-- precisa de moderação de staff).
DROP POLICY IF EXISTS "favoritos_dono" ON favoritos;
CREATE POLICY "favoritos_dono" ON favoritos FOR ALL TO authenticated
  USING (aluno_id = public.meu_aluno_id())
  WITH CHECK (aluno_id = public.meu_aluno_id());

DROP POLICY IF EXISTS "favoritos_select_staff" ON favoritos;
CREATE POLICY "favoritos_select_staff" ON favoritos FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- indicacoes_compra: aluno cria e vê as próprias; staff vê/decide todas.
DROP POLICY IF EXISTS "indicacoes_compra_select" ON indicacoes_compra;
CREATE POLICY "indicacoes_compra_select" ON indicacoes_compra FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "indicacoes_compra_insert" ON indicacoes_compra;
CREATE POLICY "indicacoes_compra_insert" ON indicacoes_compra FOR INSERT TO authenticated
  WITH CHECK (aluno_id = public.meu_aluno_id());

DROP POLICY IF EXISTS "indicacoes_compra_update_staff" ON indicacoes_compra;
CREATE POLICY "indicacoes_compra_update_staff" ON indicacoes_compra FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP TRIGGER IF EXISTS trg_auditoria_emprestimos ON emprestimos;
CREATE TRIGGER trg_auditoria_emprestimos
  AFTER INSERT OR UPDATE OR DELETE ON emprestimos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
