-- ====================================================================================
-- GESTÃO ESCOLAR — Sub-módulo 4a: Almoxarifado (material de expediente/limpeza,
-- financiado por PDDE/recursos próprios — BASE SEPARADA do estoque do PNAE, que
-- continua vivendo só em estoque_itens/estoque_lotes/estoque_movimentacoes, no
-- módulo Cozinha. Nenhuma tabela aqui referencia ou é referenciada por aquelas.
--
-- REGRA ATÔMICA (mesma régua do ledger de pontos da Biblioteca): saldo é sempre
-- SOMA de `movimentacao_material`, nunca um contador mutável avulso. A diferença
-- em relação ao resgate da Biblioteca (que travava a LINHA de `recompensas.estoque`
-- com FOR UPDATE) é que aqui não existe uma linha mutável pra travar — o saldo é
-- 100% derivado do extrato, por pedido explícito. Duas requisições atendidas ao
-- mesmo tempo para o mesmo material, se cada uma só lesse o SUM e depois inserisse
-- sua SAIDA, poderiam as duas ver saldo suficiente e as duas passarem (a soma final
-- ficaria negativa). A trava usada aqui é `pg_advisory_xact_lock(hashtext(material_id))`
-- — um lock lógico do Postgres, escopado à transação, chaveado pelo material: a
-- segunda chamada concorrente para o MESMO material espera a primeira commitar (ou
-- reverter) antes de ler o saldo, então sempre lê o valor já atualizado.
-- ====================================================================================

CREATE TABLE IF NOT EXISTS materiais (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           TEXT NOT NULL,
  categoria      TEXT NOT NULL CHECK (categoria IN ('EXPEDIENTE', 'LIMPEZA', 'OUTRO')),
  unidade        TEXT NOT NULL,
  estoque_minimo NUMERIC NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  ativo          BOOLEAN NOT NULL DEFAULT true,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extrato — fonte única de verdade do saldo. Sem policy de INSERT/UPDATE/DELETE para
-- ninguém: a única porta de entrada são as RPCs abaixo (SECURITY DEFINER).
CREATE TABLE IF NOT EXISTS movimentacao_material (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   UUID NOT NULL REFERENCES materiais(id),
  tipo          TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA', 'AJUSTE')),
  -- ENTRADA/SAIDA sempre positivas (o `tipo` já diz a direção); AJUSTE carrega o
  -- sinal (correção pra cima ou pra baixo).
  quantidade    NUMERIC NOT NULL,
  motivo        TEXT,
  referencia    TEXT, -- nota fiscal, nº de requisição, etc. — texto livre
  fonte_recurso TEXT, -- ex.: 'PDDE', 'APM'
  criado_por    UUID REFERENCES usuarios(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT movimentacao_material_sinal CHECK (
    (tipo IN ('ENTRADA', 'SAIDA') AND quantidade > 0) OR
    (tipo = 'AJUSTE' AND quantidade <> 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_movimentacao_material_material ON movimentacao_material (material_id);

CREATE OR REPLACE VIEW vw_saldo_material AS
  SELECT material_id,
    SUM(CASE WHEN tipo = 'SAIDA' THEN -quantidade ELSE quantidade END) AS saldo
  FROM movimentacao_material
  GROUP BY material_id;

CREATE TABLE IF NOT EXISTS requisicoes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id    UUID NOT NULL REFERENCES usuarios(id),
  setor             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ATENDIDA', 'RECUSADA')),
  observacao_recusa TEXT, -- coluna a mais em relação ao modelo pedido: guarda o motivo
                          -- passado pra rpc_recusar_requisicao (sem ela, o motivo se
                          -- perderia). Avise se preferir removê-la.
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  atendida_por      UUID REFERENCES usuarios(id),
  atendida_em       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS requisicao_itens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id         UUID NOT NULL REFERENCES requisicoes(id),
  material_id           UUID NOT NULL REFERENCES materiais(id),
  quantidade_solicitada NUMERIC NOT NULL CHECK (quantidade_solicitada > 0),
  quantidade_atendida   NUMERIC CHECK (quantidade_atendida IS NULL OR quantidade_atendida >= 0)
);

CREATE INDEX IF NOT EXISTS idx_requisicao_itens_requisicao ON requisicao_itens (requisicao_id);

ALTER TABLE materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais FORCE ROW LEVEL SECURITY;
ALTER TABLE movimentacao_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacao_material FORCE ROW LEVEL SECURITY;
ALTER TABLE requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisicoes FORCE ROW LEVEL SECURITY;
ALTER TABLE requisicao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisicao_itens FORCE ROW LEVEL SECURITY;

-- Catálogo: leitura para qualquer "servidor" (quem pode requisitar + quem gere).
-- Nunca ALUNO/RESPONSAVEL. Escrita (cadastrar material, mudar estoque_minimo/ativo)
-- só GESTAO/SECRETARIA.
DROP POLICY IF EXISTS "materiais_select_servidor" ON materiais;
CREATE POLICY "materiais_select_servidor" ON materiais FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
    public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
    public.usuario_tem_papel('INSPETOR')
  );

DROP POLICY IF EXISTS "materiais_write_gestao" ON materiais;
CREATE POLICY "materiais_write_gestao" ON materiais FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

-- Extrato: mesma visibilidade do catálogo (qualquer servidor) — sem isso, quem só
-- pode requisitar não veria o saldo disponível (vw_saldo_material herda a RLS da
-- tabela base) na hora de montar o pedido. Escrita continua só via RPC (sem policy
-- de INSERT/UPDATE/DELETE para ninguém).
DROP POLICY IF EXISTS "movimentacao_material_select_gestao" ON movimentacao_material;
CREATE POLICY "movimentacao_material_select_servidor" ON movimentacao_material FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
    public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
    public.usuario_tem_papel('INSPETOR')
  );

-- Requisições: dono vê a própria; GESTAO/SECRETARIA vê todas. INSERT só a RPC
-- rpc_criar_requisicao (garante que sempre nasce com pelo menos 1 item, atômica).
-- Sem UPDATE direto pra ninguém — atender/recusar são sempre RPC.
DROP POLICY IF EXISTS "requisicoes_select" ON requisicoes;
CREATE POLICY "requisicoes_select" ON requisicoes FOR SELECT TO authenticated
  USING (solicitante_id = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA'));

DROP POLICY IF EXISTS "requisicao_itens_select" ON requisicao_itens;
CREATE POLICY "requisicao_itens_select" ON requisicao_itens FOR SELECT TO authenticated
  USING (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    EXISTS (SELECT 1 FROM requisicoes r WHERE r.id = requisicao_itens.requisicao_id AND r.solicitante_id = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_auditoria_materiais ON materiais;
CREATE TRIGGER trg_auditoria_materiais
  AFTER INSERT OR UPDATE OR DELETE ON materiais
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_movimentacao_material ON movimentacao_material;
CREATE TRIGGER trg_auditoria_movimentacao_material
  AFTER INSERT OR UPDATE OR DELETE ON movimentacao_material
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_requisicoes ON requisicoes;
CREATE TRIGGER trg_auditoria_requisicoes
  AFTER INSERT OR UPDATE OR DELETE ON requisicoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria_requisicao_itens ON requisicao_itens;
CREATE TRIGGER trg_auditoria_requisicao_itens
  AFTER INSERT OR UPDATE OR DELETE ON requisicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- RPC 1: criar requisição (aluno-de-servidor, por assim dizer) — cria o cabeçalho e
-- os itens na MESMA transação da função, então nunca existe requisição órfã sem
-- item (o que existiria se o cliente inserisse cabeçalho e itens em duas chamadas
-- separadas e a segunda falhasse no meio).
-- p_itens: [{"material_id": "<uuid>", "quantidade": 3}, ...]
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_criar_requisicao(p_setor TEXT, p_itens JSONB)
RETURNS requisicoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requisicao requisicoes;
  v_item RECORD;
BEGIN
  IF NOT (
    public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA') OR
    public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR
    public.usuario_tem_papel('NUTRICAO') OR public.usuario_tem_papel('BIBLIOTECA') OR
    public.usuario_tem_papel('INSPETOR')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar requisição.';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A requisição precisa ter pelo menos um item.';
  END IF;

  INSERT INTO requisicoes (solicitante_id, setor) VALUES (auth.uid(), p_setor) RETURNING * INTO v_requisicao;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_itens) AS x(material_id UUID, quantidade NUMERIC)
  LOOP
    IF v_item.quantidade IS NULL OR v_item.quantidade <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para o material %.', v_item.material_id;
    END IF;
    INSERT INTO requisicao_itens (requisicao_id, material_id, quantidade_solicitada)
    VALUES (v_requisicao.id, v_item.material_id, v_item.quantidade);
  END LOOP;

  RETURN v_requisicao;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_requisicao(TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_criar_requisicao(TEXT, JSONB) TO authenticated;

-- ------------------------------------------------------------------------------------
-- RPC 2: atender requisição — decide item a item (permite atendimento parcial:
-- quantidade_atendida pode ser menor que a solicitada). Cada item com
-- quantidade_atendida > 0 gera uma SAIDA atômica no extrato, travada por
-- pg_advisory_xact_lock antes de ler o saldo — é isso que impede duas requisições
-- atendidas ao mesmo tempo de estourarem o saldo do mesmo material pra negativo.
-- p_decisoes: [{"item_id": "<uuid>", "quantidade_atendida": 2}, ...]
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_atender_requisicao(p_requisicao_id UUID, p_decisoes JSONB)
RETURNS requisicoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requisicao requisicoes;
  v_decisao RECORD;
  v_item requisicao_itens;
  v_saldo NUMERIC;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para atender requisições.';
  END IF;

  SELECT * INTO v_requisicao FROM requisicoes WHERE id = p_requisicao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requisição não encontrada.';
  END IF;
  IF v_requisicao.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'Esta requisição já foi decidida.';
  END IF;

  FOR v_decisao IN SELECT * FROM jsonb_to_recordset(p_decisoes) AS x(item_id UUID, quantidade_atendida NUMERIC)
  LOOP
    SELECT * INTO v_item FROM requisicao_itens WHERE id = v_decisao.item_id AND requisicao_id = p_requisicao_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'O item % não pertence a esta requisição.', v_decisao.item_id;
    END IF;
    IF v_decisao.quantidade_atendida IS NULL OR v_decisao.quantidade_atendida < 0 OR v_decisao.quantidade_atendida > v_item.quantidade_solicitada THEN
      RAISE EXCEPTION 'Quantidade atendida inválida para o item % (solicitado: %).', v_decisao.item_id, v_item.quantidade_solicitada;
    END IF;

    IF v_decisao.quantidade_atendida > 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext(v_item.material_id::text));

      SELECT COALESCE(saldo, 0) INTO v_saldo FROM vw_saldo_material WHERE material_id = v_item.material_id;

      IF v_saldo < v_decisao.quantidade_atendida THEN
        RAISE EXCEPTION 'Saldo insuficiente para o material % (saldo atual: %, solicitado: %).', v_item.material_id, v_saldo, v_decisao.quantidade_atendida;
      END IF;

      INSERT INTO movimentacao_material (material_id, tipo, quantidade, motivo, referencia, criado_por)
      VALUES (v_item.material_id, 'SAIDA', v_decisao.quantidade_atendida, 'Atendimento de requisição', p_requisicao_id::text, auth.uid());
    END IF;

    UPDATE requisicao_itens SET quantidade_atendida = v_decisao.quantidade_atendida WHERE id = v_decisao.item_id;
  END LOOP;

  UPDATE requisicoes SET status = 'ATENDIDA', atendida_por = auth.uid(), atendida_em = now()
  WHERE id = p_requisicao_id
  RETURNING * INTO v_requisicao;

  RETURN v_requisicao;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_atender_requisicao(UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_atender_requisicao(UUID, JSONB) TO authenticated;

-- ------------------------------------------------------------------------------------
-- RPC 3: recusar requisição inteira (sem impacto no extrato).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_recusar_requisicao(p_requisicao_id UUID, p_motivo TEXT)
RETURNS requisicoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requisicao requisicoes;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para recusar requisições.';
  END IF;

  UPDATE requisicoes
  SET status = 'RECUSADA', atendida_por = auth.uid(), atendida_em = now(), observacao_recusa = p_motivo
  WHERE id = p_requisicao_id AND status = 'PENDENTE'
  RETURNING * INTO v_requisicao;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requisição não encontrada ou já decidida.';
  END IF;

  RETURN v_requisicao;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_recusar_requisicao(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_recusar_requisicao(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------------
-- RPC 4: registrar movimentação manual (ENTRADA de compra/doação, AJUSTE de
-- inventário, ou SAIDA avulsa não ligada a requisição — ex.: perda/descarte).
-- Mesma trava de concorrência para SAIDA e AJUSTE negativo.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_registrar_movimentacao_material(
  p_material_id UUID, p_tipo TEXT, p_quantidade NUMERIC, p_motivo TEXT,
  p_referencia TEXT DEFAULT NULL, p_fonte_recurso TEXT DEFAULT NULL
)
RETURNS movimentacao_material
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movimentacao movimentacao_material;
  v_saldo NUMERIC;
  v_debita BOOLEAN;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('SECRETARIA')) THEN
    RAISE EXCEPTION 'Sem permissão para registrar movimentação de material.';
  END IF;

  IF p_tipo NOT IN ('ENTRADA', 'SAIDA', 'AJUSTE') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido.';
  END IF;

  v_debita := (p_tipo = 'SAIDA') OR (p_tipo = 'AJUSTE' AND p_quantidade < 0);

  IF v_debita THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_material_id::text));
    SELECT COALESCE(saldo, 0) INTO v_saldo FROM vw_saldo_material WHERE material_id = p_material_id;
    IF v_saldo < abs(p_quantidade) THEN
      RAISE EXCEPTION 'Saldo insuficiente (saldo atual: %, tentativa de baixa: %).', v_saldo, abs(p_quantidade);
    END IF;
  END IF;

  INSERT INTO movimentacao_material (material_id, tipo, quantidade, motivo, referencia, fonte_recurso, criado_por)
  VALUES (p_material_id, p_tipo, p_quantidade, p_motivo, p_referencia, p_fonte_recurso, auth.uid())
  RETURNING * INTO v_movimentacao;

  RETURN v_movimentacao;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_movimentacao_material(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_movimentacao_material(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
