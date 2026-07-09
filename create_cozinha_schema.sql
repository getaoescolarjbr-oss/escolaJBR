-- ====================================================================================
-- MÓDULO COZINHA (PNAE) — correção da Etapa 1 sobre uma base que, ao investigar,
-- descobri já estar parcialmente construída nesta mesma conversa (frontend completo:
-- CozinhaPanel/EstoqueTab/FornecedoresTab/CardapioTab/IndicadoresTab + cozinhaService),
-- só que sobre um schema com os mesmos 3 gaps que eu tinha corrigido numa reescrita
-- anterior — só que renomeando tabelas, o que quebraria todo esse frontend à toa.
-- Revertido: aqui eu MANTENHO os nomes originais (fornecedores, estoque_itens,
-- estoque_lotes, estoque_movimentacoes, cardapios, cardapio_itens, refeicoes_servidas)
-- e só ADICIONO o que faltava. As 7 tabelas tinham 0 linhas (conferido ao vivo antes
-- de dropar), então recriar do zero com os nomes certos é seguro.
--
-- Gaps corrigidos nesta versão:
--   1) Sem fonte_recurso/origem por lote — impossível provar exclusividade do PNAE
--      para alimento. Adicionado em estoque_lotes, com notas_fiscais nova.
--   2) estoque_movimentacoes tinha policy "FOR ALL" (INSERT direto, inclusive SAIDA
--      maior que o saldo) — cozinhaService.receberLote/registrarMovimentacao faziam
--      INSERT cru. Trocado por SELECT-only + rpc_registrar_movimentacao_estoque
--      (advisory lock por lote, nunca deixa saldo negativo — mesma régua do
--      Almoxarifado). O service e as telas são ajustados nesta mesma entrega para
--      chamar a RPC em vez do INSERT direto.
--   3) Cardápio: nutricionista_pessoa_id existia mas SEM QUALQUER validação — a tela
--      criava cardápio com nutricionista_pessoa_id sempre null, e "publicado" não
--      exigia RT. Adicionada trigger: publicado só pode virar true se
--      nutricionista_pessoa_id apontar pra uma pessoa cujo usuário tem o papel
--      NUTRICAO (decisão confirmada com o usuário: papel NUTRICAO, sem campo de
--      registro profissional novo por enquanto).
--   4) Sem notas_fiscais nem bucket de Storage — guarda de 5 anos não tinha onde
--      acontecer.
-- ====================================================================================
DROP VIEW IF EXISTS vw_saldo_lotes;
DROP TABLE IF EXISTS cardapio_itens;
DROP TABLE IF EXISTS refeicoes_servidas;
DROP TABLE IF EXISTS cardapios;
DROP TABLE IF EXISTS estoque_movimentacoes;
DROP TABLE IF EXISTS estoque_lotes;
DROP TABLE IF EXISTS estoque_itens;
DROP TABLE IF EXISTS fornecedores;

-- ------------------------------------------------------------------------------------
-- 1. fornecedores — grupo_prioritario é novo (acompanhamento da cota de agricultura
--    familiar); resto igual ao que a tela FornecedoresTab.tsx já espera.
-- ------------------------------------------------------------------------------------
CREATE TABLE fornecedores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                TEXT NOT NULL,
  cnpj_cpf            TEXT,
  agricultura_familiar BOOLEAN NOT NULL DEFAULT false,
  dap_caf_numero      TEXT,
  contato             TEXT,
  grupo_prioritario   TEXT CHECK (grupo_prioritario IN ('ASSENTAMENTO', 'INDIGENA', 'QUILOMBOLA', 'MULHERES', 'JOVENS')),
  ativo               BOOLEAN NOT NULL DEFAULT true,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedores_rw_gestao_nutricao" ON fornecedores FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE TRIGGER trg_auditoria_fornecedores
  AFTER INSERT OR UPDATE OR DELETE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 2. estoque_itens — catálogo. estoque_minimo/perecivel são novos (alerta de estoque
--    mínimo e validade próxima, consumidos pelos indicadores da Gestão numa próxima
--    etapa); resto igual ao que EstoqueTab.tsx/CardapioTab.tsx já esperam.
-- ------------------------------------------------------------------------------------
CREATE TABLE estoque_itens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT NOT NULL,
  unidade_medida    TEXT NOT NULL CHECK (unidade_medida IN ('KG', 'LITRO', 'UNIDADE', 'PACOTE', 'CAIXA', 'DUZIA')),
  classificacao_pnae TEXT NOT NULL CHECK (classificacao_pnae IN ('IN_NATURA', 'MINIMAMENTE_PROCESSADO', 'PROCESSADO', 'ULTRAPROCESSADO')),
  perecivel         BOOLEAN NOT NULL DEFAULT true,
  estoque_minimo    NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  ativo             BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE estoque_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_itens_rw_gestao_nutricao" ON estoque_itens FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE TRIGGER trg_auditoria_estoque_itens
  AFTER INSERT OR UPDATE OR DELETE ON estoque_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 3. notas_fiscais — nova. Guarda de 5 anos via arquivo_path no bucket privado do
--    item 8. Fica em texto/número aqui; o arquivo em si vive no Storage.
-- ------------------------------------------------------------------------------------
CREATE TABLE notas_fiscais (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id  UUID NOT NULL REFERENCES fornecedores(id),
  numero         TEXT NOT NULL,
  data           DATE NOT NULL,
  valor          NUMERIC(12, 2) NOT NULL CHECK (valor >= 0),
  arquivo_path   TEXT,
  registrado_por UUID NOT NULL REFERENCES usuarios(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notas_fiscais_fornecedor ON notas_fiscais (fornecedor_id);

ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notas_fiscais_rw_gestao_nutricao" ON notas_fiscais FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE TRIGGER trg_auditoria_notas_fiscais
  AFTER INSERT OR UPDATE OR DELETE ON notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 4. estoque_lotes — origem/fonte_recurso/nota_fiscal_id são novos. NÃO tem coluna de
--    quantidade recebida (decisão original mantida): o recebido só existe como o
--    lançamento ENTRADA em estoque_movimentacoes, pra nunca ter dois números que podem
--    divergir. fonte_recurso prova, lote a lote, que o recurso PNAE só compra o que
--    está aqui dentro (que é, por definição, alimento — estoque_itens não tem nenhuma
--    relação com a tabela `materiais` do Almoxarifado, Fase 4a: a separação é
--    estrutural, não depende de validação de tela).
-- ------------------------------------------------------------------------------------
CREATE TABLE estoque_lotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID NOT NULL REFERENCES estoque_itens(id),
  numero_lote    TEXT NOT NULL,
  fornecedor_id  UUID REFERENCES fornecedores(id),
  nota_fiscal_id UUID REFERENCES notas_fiscais(id),
  validade       DATE,
  valor_unitario NUMERIC(10, 2),
  origem         TEXT NOT NULL DEFAULT 'OUTRO' CHECK (origem IN ('AGRICULTURA_FAMILIAR', 'LICITACAO', 'DOACAO', 'OUTRO')),
  fonte_recurso  TEXT NOT NULL DEFAULT 'PNAE' CHECK (fonte_recurso IN ('PNAE', 'PDDE', 'OUTRO')),
  recebido_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  recebido_por   UUID NOT NULL REFERENCES usuarios(id),
  UNIQUE (item_id, numero_lote)
);

CREATE INDEX idx_estoque_lotes_item ON estoque_lotes (item_id);
CREATE INDEX idx_estoque_lotes_validade ON estoque_lotes (validade);

ALTER TABLE estoque_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_lotes_rw_gestao_nutricao" ON estoque_lotes FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE TRIGGER trg_auditoria_estoque_lotes
  AFTER INSERT OR UPDATE OR DELETE ON estoque_lotes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 5. estoque_movimentacoes — ledger. SEM policy de INSERT/UPDATE/DELETE: a única forma
--    de gravar é rpc_registrar_movimentacao_estoque (item 6), que roda como owner da
--    função (SECURITY DEFINER) e ignora RLS pra fazer o INSERT depois de validar saldo.
-- ------------------------------------------------------------------------------------
CREATE TABLE estoque_movimentacoes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id           UUID NOT NULL REFERENCES estoque_lotes(id),
  tipo              TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA', 'PERDA', 'AJUSTE')),
  quantidade        NUMERIC(12, 3) NOT NULL CHECK (quantidade > 0),
  data_movimentacao DATE NOT NULL DEFAULT current_date,
  motivo            TEXT,
  registrado_por    UUID NOT NULL REFERENCES usuarios(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estoque_mov_lote ON estoque_movimentacoes (lote_id);
CREATE INDEX idx_estoque_mov_data ON estoque_movimentacoes (data_movimentacao);

ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_mov_select_gestao_nutricao" ON estoque_movimentacoes FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE TRIGGER trg_auditoria_estoque_mov
  AFTER INSERT OR UPDATE OR DELETE ON estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- View de saldo atual por lote — mesma forma que o frontend (SaldoLote/listarSaldos)
-- já espera: lote_id, item_id, numero_lote, validade, saldo_atual. fonte_recurso
-- adicionada no fim (aditivo, não quebra `select *` existente).
CREATE OR REPLACE VIEW vw_saldo_lotes AS
SELECT
  l.id AS lote_id,
  l.item_id,
  l.numero_lote,
  l.validade,
  COALESCE(SUM(CASE WHEN m.tipo IN ('ENTRADA', 'AJUSTE') THEN m.quantidade
                    WHEN m.tipo IN ('SAIDA', 'PERDA') THEN -m.quantidade
                    ELSE 0 END), 0) AS saldo_atual,
  l.fonte_recurso
FROM estoque_lotes l
LEFT JOIN estoque_movimentacoes m ON m.lote_id = l.id
GROUP BY l.id, l.item_id, l.numero_lote, l.validade, l.fonte_recurso;

-- ------------------------------------------------------------------------------------
-- 6. rpc_registrar_movimentacao_estoque — única porta de escrita no extrato (ENTRADA
--    inicial do recebimento e SAIDA/PERDA/AJUSTE depois). Mesma régua do Almoxarifado:
--    pg_advisory_xact_lock no lote_id serializa concorrência sobre o MESMO lote; SAIDA/
--    PERDA que deixaria o saldo negativo é recusada dentro da mesma transação que
--    fez o lock.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_registrar_movimentacao_estoque(
  p_lote_id UUID,
  p_tipo TEXT,
  p_quantidade NUMERIC,
  p_motivo TEXT DEFAULT NULL,
  p_data DATE DEFAULT current_date
)
RETURNS estoque_movimentacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_atual NUMERIC;
  v_row estoque_movimentacoes;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO')) THEN
    RAISE EXCEPTION 'Sem permissão para registrar movimentação de estoque.' USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('ENTRADA', 'SAIDA', 'PERDA', 'AJUSTE') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_tipo;
  END IF;

  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_lote_id::text));

  IF p_tipo IN ('SAIDA', 'PERDA') THEN
    SELECT saldo_atual INTO v_saldo_atual FROM vw_saldo_lotes WHERE lote_id = p_lote_id;
    IF v_saldo_atual IS NULL THEN
      RAISE EXCEPTION 'Lote não encontrado.';
    END IF;
    IF v_saldo_atual < p_quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente no lote (disponível: %, solicitado: %).', v_saldo_atual, p_quantidade USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO estoque_movimentacoes (lote_id, tipo, quantidade, motivo, data_movimentacao, registrado_por)
  VALUES (p_lote_id, p_tipo, p_quantidade, p_motivo, p_data, auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_movimentacao_estoque(UUID, TEXT, NUMERIC, TEXT, DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_movimentacao_estoque(UUID, TEXT, NUMERIC, TEXT, DATE) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 7. cardapios / cardapio_itens — leitura aberta pra autenticados quando publicado
--    (decisão já confirmada antes); rascunho só GESTAO/NUTRICAO. NOVO: trigger que
--    barra publicado=true sem RT válido (papel NUTRICAO na pessoa indicada).
-- ------------------------------------------------------------------------------------
CREATE TABLE cardapios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data                DATE NOT NULL,
  turno               TEXT NOT NULL CHECK (turno IN ('Matutino', 'Vespertino', 'Noturno', 'Integral')),
  nutricionista_pessoa_id UUID REFERENCES pessoas(id),
  publicado           BOOLEAN NOT NULL DEFAULT false,
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (data, turno)
);

ALTER TABLE cardapios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cardapios_select_gestao_nutricao" ON cardapios FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE POLICY "cardapios_select_publicado" ON cardapios FOR SELECT TO authenticated
  USING (publicado = true);

CREATE POLICY "cardapios_write_gestao_nutricao" ON cardapios FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE POLICY "cardapios_update_gestao_nutricao" ON cardapios FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE POLICY "cardapios_delete_gestao_nutricao" ON cardapios FOR DELETE TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE TRIGGER trg_auditoria_cardapios
  AFTER INSERT OR UPDATE OR DELETE ON cardapios
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- "Sem RT, o cardápio não é válido": publicado só pode ser true se
-- nutricionista_pessoa_id apontar pra uma pessoa cujo usuário tem o papel NUTRICAO.
CREATE OR REPLACE FUNCTION public.fn_valida_cardapio_rt()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.publicado = true THEN
    IF NEW.nutricionista_pessoa_id IS NULL THEN
      RAISE EXCEPTION 'Cardápio não pode ser publicado sem um nutricionista responsável técnico definido.' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM usuarios u
      JOIN usuario_papeis up ON up.usuario_id = u.id
      WHERE u.pessoa_id = NEW.nutricionista_pessoa_id AND up.papel = 'NUTRICAO'
    ) THEN
      RAISE EXCEPTION 'A pessoa indicada como responsável técnico não possui o papel NUTRICAO.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_valida_cardapio_rt
  BEFORE INSERT OR UPDATE ON cardapios
  FOR EACH ROW EXECUTE FUNCTION public.fn_valida_cardapio_rt();

-- Lista pessoas com papel NUTRICAO — usada pelo seletor de RT na tela de cardápio
-- (NUTRICAO/GESTAO não têm acesso de leitura geral a usuario_papeis, então precisa de
-- uma RPC dedicada em vez de embed do PostgREST).
CREATE OR REPLACE FUNCTION public.rpc_listar_nutricionistas()
RETURNS TABLE (pessoa_id UUID, nome TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.nome
  FROM usuario_papeis up
  JOIN usuarios u ON u.id = up.usuario_id
  JOIN pessoas p ON p.id = u.pessoa_id
  WHERE up.papel = 'NUTRICAO'
  ORDER BY p.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_listar_nutricionistas() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_listar_nutricionistas() TO authenticated;

CREATE TABLE cardapio_itens (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cardapio_id                   UUID NOT NULL REFERENCES cardapios(id) ON DELETE CASCADE,
  item_id                       UUID NOT NULL REFERENCES estoque_itens(id),
  descricao_preparacao          TEXT,
  quantidade_planejada_por_aluno NUMERIC(10, 3) NOT NULL
);

CREATE INDEX idx_cardapio_itens_cardapio ON cardapio_itens (cardapio_id);

ALTER TABLE cardapio_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cardapio_itens_select_gestao_nutricao" ON cardapio_itens FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE POLICY "cardapio_itens_select_publicado" ON cardapio_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cardapios c WHERE c.id = cardapio_itens.cardapio_id AND c.publicado = true));

CREATE POLICY "cardapio_itens_write_gestao_nutricao" ON cardapio_itens FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE POLICY "cardapio_itens_update_gestao_nutricao" ON cardapio_itens FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE POLICY "cardapio_itens_delete_gestao_nutricao" ON cardapio_itens FOR DELETE TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE TRIGGER trg_auditoria_cardapio_itens
  AFTER INSERT OR UPDATE OR DELETE ON cardapio_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 8. refeicoes_servidas — igual ao original.
-- ------------------------------------------------------------------------------------
CREATE TABLE refeicoes_servidas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cardapio_id        UUID NOT NULL REFERENCES cardapios(id),
  quantidade_alunos  INTEGER NOT NULL CHECK (quantidade_alunos >= 0),
  registrado_por     UUID NOT NULL REFERENCES usuarios(id),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cardapio_id)
);

ALTER TABLE refeicoes_servidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refeicoes_servidas_rw_gestao_nutricao" ON refeicoes_servidas FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO'));

CREATE TRIGGER trg_auditoria_refeicoes_servidas
  AFTER INSERT OR UPDATE OR DELETE ON refeicoes_servidas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 9. rpc_indicadores_pnae — igual ao original (JSON consumido por IndicadoresTab.tsx),
--    fonte_recurso incluído no filtro de agricultura familiar (a cota de 45% é medida
--    sobre o recurso PNAE especificamente).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_indicadores_pnae(p_data_inicio DATE, p_data_fim DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO')) THEN
    RAISE EXCEPTION 'Sem permissão para consultar indicadores da Cozinha.' USING ERRCODE = '42501';
  END IF;

  WITH entradas AS (
    SELECT
      m.quantidade * COALESCE(l.valor_unitario, 0) AS valor,
      ei.classificacao_pnae,
      l.fonte_recurso,
      COALESCE(f.agricultura_familiar, false) AS agricultura_familiar
    FROM estoque_movimentacoes m
    JOIN estoque_lotes l ON l.id = m.lote_id
    JOIN estoque_itens ei ON ei.id = l.item_id
    LEFT JOIN fornecedores f ON f.id = l.fornecedor_id
    WHERE m.tipo = 'ENTRADA' AND m.data_movimentacao BETWEEN p_data_inicio AND p_data_fim
  )
  SELECT jsonb_build_object(
    'valor_total', COALESCE(SUM(valor), 0),
    'valor_in_natura_minimamente_processado', COALESCE(SUM(valor) FILTER (WHERE classificacao_pnae IN ('IN_NATURA', 'MINIMAMENTE_PROCESSADO')), 0),
    'valor_ultraprocessado', COALESCE(SUM(valor) FILTER (WHERE classificacao_pnae = 'ULTRAPROCESSADO'), 0),
    'valor_agricultura_familiar', COALESCE(SUM(valor) FILTER (WHERE agricultura_familiar AND fonte_recurso = 'PNAE'), 0),
    'valor_total_pnae', COALESCE(SUM(valor) FILTER (WHERE fonte_recurso = 'PNAE'), 0)
  ) INTO v_result
  FROM entradas;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_indicadores_pnae(DATE, DATE) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_indicadores_pnae(DATE, DATE) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 10. Bucket de Storage `cozinha-documentos` — PRIVADO. Guarda notas fiscais agora e,
--     em próximas etapas, inspeções sanitárias e laudos de necessidades especiais
--     (path prefixado por tipo: notas-fiscais/{id}/..., inspecoes/{id}/...,
--     laudos/{id}/...). DELETE restrito a GESTAO (correção administrativa).
-- ------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('cozinha-documentos', 'cozinha-documentos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cozinha_documentos_select" ON storage.objects;
CREATE POLICY "cozinha_documentos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cozinha-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO')));

DROP POLICY IF EXISTS "cozinha_documentos_insert" ON storage.objects;
CREATE POLICY "cozinha_documentos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cozinha-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO')));

DROP POLICY IF EXISTS "cozinha_documentos_update" ON storage.objects;
CREATE POLICY "cozinha_documentos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cozinha-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO')))
  WITH CHECK (bucket_id = 'cozinha-documentos' AND (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('NUTRICAO')));

DROP POLICY IF EXISTS "cozinha_documentos_delete" ON storage.objects;
CREATE POLICY "cozinha_documentos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cozinha-documentos' AND public.usuario_tem_papel('GESTAO'));
