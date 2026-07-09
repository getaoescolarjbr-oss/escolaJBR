-- ====================================================================================
-- BIBLIOTECA — Fase 1 (6/8): Loja de prêmios.
--
-- REGRA ATÔMICA #3 (resgate nunca estoura saldo/estoque): rpc_resgatar_recompensa é
-- uma única função SECURITY DEFINER que faz SELECT ... FOR UPDATE na recompensa (trava
-- a linha), confere estoque e saldo, e só então debita os dois — tudo dentro da mesma
-- transação implícita da função. O FOR UPDATE é o que impede dois resgates
-- simultâneos do mesmo prêmio (ex.: última unidade) de ambos lerem estoque=1 e ambos
-- passarem: o segundo fica bloqueado esperando o primeiro terminar (commit/rollback) e
-- então vê o estoque já atualizado. Mesmo padrão de atomicidade já usado no débito de
-- estoque da Cozinha e na reserva de recursos do Agendamento.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS recompensas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  descricao    TEXT,
  imagem_url   TEXT,
  custo_pontos INTEGER NOT NULL CHECK (custo_pontos > 0),
  estoque      INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_por   UUID REFERENCES usuarios(id),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resgates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      UUID NOT NULL REFERENCES alunos(id),
  recompensa_id UUID NOT NULL REFERENCES recompensas(id),
  custo_pontos  INTEGER NOT NULL,
  codigo        TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ENTREGUE', 'CANCELADO')),
  entregue_por  UUID REFERENCES usuarios(id),
  entregue_em   TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resgates_aluno ON resgates (aluno_id);

CREATE TABLE IF NOT EXISTS cupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         TEXT NOT NULL UNIQUE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('DESCONTO_PONTOS', 'BONUS_PONTOS')),
  valor          NUMERIC NOT NULL,
  validade       DATE,
  usos_maximos   INTEGER,
  usos_atuais    INTEGER NOT NULL DEFAULT 0,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recompensas FORCE ROW LEVEL SECURITY;
ALTER TABLE resgates ENABLE ROW LEVEL SECURITY;
ALTER TABLE resgates FORCE ROW LEVEL SECURITY;
ALTER TABLE cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recompensas_select_autenticado" ON recompensas;
CREATE POLICY "recompensas_select_autenticado" ON recompensas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recompensas_write_biblioteca" ON recompensas;
CREATE POLICY "recompensas_write_biblioteca" ON recompensas FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- resgates: aluno vê os próprios; staff vê/administra tudo (entrega física do prêmio).
-- SEM policy de INSERT para ninguém — o único jeito de criar um resgate é pela RPC
-- abaixo (SECURITY DEFINER), que garante a atomicidade. UPDATE só para staff marcar
-- entrega/cancelamento.
DROP POLICY IF EXISTS "resgates_select" ON resgates;
CREATE POLICY "resgates_select" ON resgates FOR SELECT TO authenticated
  USING (aluno_id = public.meu_aluno_id() OR public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "resgates_update_staff" ON resgates;
CREATE POLICY "resgates_update_staff" ON resgates FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "cupons_select_autenticado" ON cupons;
CREATE POLICY "cupons_select_autenticado" ON cupons FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cupons_write_biblioteca" ON cupons;
CREATE POLICY "cupons_write_biblioteca" ON cupons FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

-- ------------------------------------------------------------------------------------
-- RPC atômica de resgate. Chamada pelo próprio aluno (não recebe aluno_id como
-- parâmetro — usa sempre meu_aluno_id(), então ninguém consegue resgatar em nome de
-- outro aluno passando um id diferente).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_resgatar_recompensa(p_recompensa_id UUID)
RETURNS resgates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_id UUID;
  v_recompensa RECORD;
  v_saldo INTEGER;
  v_resgate resgates;
BEGIN
  v_aluno_id := public.meu_aluno_id();
  IF v_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Somente alunos podem resgatar recompensas.';
  END IF;

  -- Trava a linha da recompensa até o fim desta transação: uma segunda chamada
  -- concorrente para o mesmo prêmio espera aqui até esta terminar.
  SELECT * INTO v_recompensa FROM recompensas WHERE id = p_recompensa_id FOR UPDATE;
  IF NOT FOUND OR v_recompensa.ativo = false THEN
    RAISE EXCEPTION 'Recompensa indisponível.';
  END IF;
  IF v_recompensa.estoque <= 0 THEN
    RAISE EXCEPTION 'Recompensa sem estoque.';
  END IF;

  SELECT COALESCE(SUM(delta), 0) INTO v_saldo FROM pontos_ledger WHERE aluno_id = v_aluno_id;
  IF v_saldo < v_recompensa.custo_pontos THEN
    RAISE EXCEPTION 'Saldo de pontos insuficiente.';
  END IF;

  UPDATE recompensas SET estoque = estoque - 1 WHERE id = p_recompensa_id;

  INSERT INTO resgates (aluno_id, recompensa_id, custo_pontos, codigo)
  VALUES (v_aluno_id, p_recompensa_id, v_recompensa.custo_pontos, upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)))
  RETURNING * INTO v_resgate;

  INSERT INTO pontos_ledger (aluno_id, delta, origem, referencia_id, criado_por)
  VALUES (v_aluno_id, -v_recompensa.custo_pontos, 'RESGATE_LOJA', v_resgate.id, auth.uid());

  RETURN v_resgate;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_resgatar_recompensa(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_resgatar_recompensa(UUID) TO authenticated;

DROP TRIGGER IF EXISTS trg_auditoria_recompensas ON recompensas;
CREATE TRIGGER trg_auditoria_recompensas
  AFTER INSERT OR UPDATE OR DELETE ON recompensas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_resgates ON resgates;
CREATE TRIGGER trg_auditoria_resgates
  AFTER INSERT OR UPDATE OR DELETE ON resgates
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
