-- ====================================================================================
-- BIBLIOTECA — Fase 1 (5/8): Gamificação (ledger de pontos, conquistas, metas).
--
-- REGRA ATÔMICA #2 (ledger sem INSERT do aluno): pontos_ledger é a fonte de verdade,
-- em estilo append-only (mesmo espírito de `auditoria` e do ledger de estoque da
-- Cozinha). Não existe policy de INSERT para o aluno — o saldo só muda por: (a)
-- trigger em `metas` quando o próprio aluno conclui uma meta legítima (controlado,
-- não é INSERT livre), (b) RPC `rpc_ajustar_pontos` para ajuste manual de
-- BIBLIOTECA/GESTAO, e (c) a RPC de resgate na Fase da Loja (débito). Nenhum caminho
-- deixa o aluno escrever um delta arbitrário.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS pontos_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      UUID NOT NULL REFERENCES alunos(id),
  delta         INTEGER NOT NULL,
  origem        TEXT NOT NULL CHECK (origem IN (
                  'META_CONCLUIDA', 'RESENHA_PUBLICADA', 'DUPLA_FORMADA',
                  'PRIMEIRO_EMPRESTIMO', 'DEVOLUCAO_PONTUAL', 'AJUSTE_MANUAL', 'RESGATE_LOJA'
                )),
  referencia_id UUID,
  criado_por    UUID REFERENCES usuarios(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pontos_ledger_aluno ON pontos_ledger (aluno_id);

-- Tabela de configuração origem -> valor em pontos, editável por GESTAO/BIBLIOTECA
-- (regra de negócio pedida: "pontos: origem -> valor, configurável pela GESTAO", em
-- vez de valores fixos espalhados pelo código). Os triggers/RPCs de crédito consultam
-- esta tabela pelo nome da origem; se não houver linha configurada, não credita nada
-- (falha segura: sem pontos, não pontos errados).
CREATE TABLE IF NOT EXISTS pontos_regras (
  origem     TEXT PRIMARY KEY CHECK (origem IN (
               'META_CONCLUIDA', 'RESENHA_PUBLICADA', 'DUPLA_FORMADA',
               'PRIMEIRO_EMPRESTIMO', 'DEVOLUCAO_PONTUAL'
             )),
  valor      INTEGER NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO pontos_regras (origem, valor) VALUES
  ('META_CONCLUIDA', 10),
  ('RESENHA_PUBLICADA', 5),
  ('DUPLA_FORMADA', 5),
  ('PRIMEIRO_EMPRESTIMO', 10),
  ('DEVOLUCAO_PONTUAL', 3)
ON CONFLICT (origem) DO NOTHING;

ALTER TABLE pontos_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos_regras FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pontos_regras_select_autenticado" ON pontos_regras;
CREATE POLICY "pontos_regras_select_autenticado" ON pontos_regras FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pontos_regras_write_gestao" ON pontos_regras;
CREATE POLICY "pontos_regras_write_gestao" ON pontos_regras FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('BIBLIOTECA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('BIBLIOTECA'));

-- Saldo é sempre derivado do ledger, nunca guardado numa coluna separada (evita
-- divergência entre "saldo" e "extrato" — o mesmo problema que o ledger de estoque da
-- Cozinha já resolvia assim).
CREATE OR REPLACE VIEW vw_saldo_pontos AS
  SELECT aluno_id, COALESCE(SUM(delta), 0)::INTEGER AS saldo
  FROM pontos_ledger
  GROUP BY aluno_id;

ALTER TABLE pontos_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos_ledger FORCE ROW LEVEL SECURITY;

-- Leitura: aluno vê o próprio extrato; BIBLIOTECA/GESTAO veem tudo (para auditar
-- ajustes e resgates). SEM policy de INSERT/UPDATE/DELETE para ninguém — nem para
-- BIBLIOTECA/GESTAO diretamente. A única porta de entrada é através de funções
-- SECURITY DEFINER (o trigger de metas abaixo e as RPCs rpc_ajustar_pontos /
-- rpc_resgatar_recompensa), que rodam como dono da tabela e por isso não são
-- bloqueadas pela ausência de policy de escrita.
DROP POLICY IF EXISTS "pontos_ledger_select" ON pontos_ledger;
CREATE POLICY "pontos_ledger_select" ON pontos_ledger FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- Ajuste manual (BIBLIOTECA/GESTAO) — único caminho de escrita direta no ledger, e
-- ainda assim só via função, nunca por INSERT cru na tabela (não há GRANT de INSERT
-- para ninguém em `pontos_ledger`; só a função, que é SECURITY DEFINER, consegue).
CREATE OR REPLACE FUNCTION public.rpc_ajustar_pontos(p_aluno_id UUID, p_delta INTEGER, p_motivo TEXT)
RETURNS pontos_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linha pontos_ledger;
BEGIN
  IF NOT (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO')) THEN
    RAISE EXCEPTION 'Sem permissão para ajustar pontos.';
  END IF;
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'O ajuste precisa ser diferente de zero.';
  END IF;

  INSERT INTO pontos_ledger (aluno_id, delta, origem, criado_por)
  VALUES (p_aluno_id, p_delta, 'AJUSTE_MANUAL', auth.uid())
  RETURNING * INTO v_linha;

  RETURN v_linha;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ajustar_pontos(UUID, INTEGER, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_ajustar_pontos(UUID, INTEGER, TEXT) TO authenticated;

-- Catálogo de conquistas (badges). A concessão automática por trigger (avaliar
-- regra_tipo/regra_limiar contra a atividade real do aluno) fica para a Fase 5, junto
-- com as telas de Metas/Conquistas — aqui só o formato de dados e o vínculo
-- aluno<->conquista.
CREATE TABLE IF NOT EXISTS conquistas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  descricao     TEXT,
  icone         TEXT,
  regra_tipo    TEXT NOT NULL,
  regra_limiar  INTEGER,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aluno_conquistas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id        UUID NOT NULL REFERENCES alunos(id),
  conquista_id    UUID NOT NULL REFERENCES conquistas(id),
  conquistado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, conquista_id)
);

ALTER TABLE conquistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conquistas FORCE ROW LEVEL SECURITY;
ALTER TABLE aluno_conquistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE aluno_conquistas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conquistas_select_autenticado" ON conquistas;
CREATE POLICY "conquistas_select_autenticado" ON conquistas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "conquistas_write_biblioteca" ON conquistas;
CREATE POLICY "conquistas_write_biblioteca" ON conquistas FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "aluno_conquistas_select" ON aluno_conquistas;
CREATE POLICY "aluno_conquistas_select" ON aluno_conquistas FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- Sem policy de INSERT para ninguém ainda — concessão é sempre via trigger/RPC
-- (SECURITY DEFINER), a ser ligada na Fase 5 conforme cada atividade que concede
-- badge for implementada.

-- Metas de leitura. O aluno pode marcar a PRÓPRIA meta como concluída (ação legítima
-- de autoatendimento), mas o crédito de pontos correspondente é feito pelo TRIGGER
-- abaixo, não por ele mesmo escrevendo em pontos_ledger — e o trigger só credita na
-- transição PENDENTE/EM_ANDAMENTO -> CONCLUIDA (verificando o valor OLD), então
-- alternar o status pra frente e pra trás não gera pontos repetidos.
CREATE TABLE IF NOT EXISTS metas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      UUID NOT NULL REFERENCES alunos(id),
  descricao     TEXT NOT NULL,
  livro_id      UUID REFERENCES livros(id),
  status        TEXT NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status IN ('EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  data_alvo     DATE,
  concluida_em  TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metas_aluno ON metas (aluno_id);

ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_select" ON metas;
CREATE POLICY "metas_select" ON metas FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "metas_insert" ON metas;
CREATE POLICY "metas_insert" ON metas FOR INSERT TO authenticated
  WITH CHECK (aluno_id = public.meu_aluno_id());

DROP POLICY IF EXISTS "metas_update" ON metas;
CREATE POLICY "metas_update" ON metas FOR UPDATE TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

CREATE OR REPLACE FUNCTION public.fn_meta_concluida_credita_pontos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor INTEGER;
BEGIN
  IF NEW.status = 'CONCLUIDA' AND OLD.status IS DISTINCT FROM 'CONCLUIDA' THEN
    NEW.concluida_em := now();
    SELECT valor INTO v_valor FROM pontos_regras WHERE origem = 'META_CONCLUIDA' AND ativo = true;
    IF v_valor IS NOT NULL THEN
      INSERT INTO pontos_ledger (aluno_id, delta, origem, referencia_id, criado_por)
      VALUES (NEW.aluno_id, v_valor, 'META_CONCLUIDA', NEW.id, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_concluida_credita_pontos ON metas;
CREATE TRIGGER trg_meta_concluida_credita_pontos
  BEFORE UPDATE ON metas
  FOR EACH ROW EXECUTE FUNCTION public.fn_meta_concluida_credita_pontos();

DROP TRIGGER IF EXISTS trg_auditoria_pontos_ledger ON pontos_ledger;
CREATE TRIGGER trg_auditoria_pontos_ledger
  AFTER INSERT OR UPDATE OR DELETE ON pontos_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_metas ON metas;
CREATE TRIGGER trg_auditoria_metas
  AFTER INSERT OR UPDATE OR DELETE ON metas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_pontos_regras ON pontos_regras;
CREATE TRIGGER trg_auditoria_pontos_regras
  AFTER INSERT OR UPDATE OR DELETE ON pontos_regras
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
