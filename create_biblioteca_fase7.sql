-- ====================================================================================
-- BIBLIOTECA — Fase 7 (Social): filtro automático de linguagem em resenhas + reforço
-- de aceite mútuo em duplas. O resto (denúncia, moderação, curtidas, indicação dentro
-- da dupla) já tinha RLS suficiente desde a Fase 1 — dá pra fazer tudo com
-- UPDATE/INSERT direto, sem precisar de RPC nova.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. Filtro automático de linguagem: lista mantida por BIBLIOTECA/GESTAO, expansível
--    pela tela (ver ConteudoModeradoTab). Começa com um punhado de termos óbvios só
--    como ponto de partida — não é uma lista exaustiva, é o catálogo que a escola vai
--    curar com o tempo.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palavras_proibidas (
  palavra   TEXT PRIMARY KEY,
  ativo     BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE palavras_proibidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE palavras_proibidas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "palavras_proibidas_select_staff" ON palavras_proibidas;
CREATE POLICY "palavras_proibidas_select_staff" ON palavras_proibidas FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'));

DROP POLICY IF EXISTS "palavras_proibidas_write_staff" ON palavras_proibidas;
CREATE POLICY "palavras_proibidas_write_staff" ON palavras_proibidas FOR ALL TO authenticated
  USING (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'))
  WITH CHECK (public.usuario_tem_papel('BIBLIOTECA') OR public.usuario_tem_papel('GESTAO'));

INSERT INTO palavras_proibidas (palavra) VALUES
  ('merda'), ('porra'), ('caralho'), ('puta'), ('viado'), ('idiota'), ('imbecil'), ('burro')
ON CONFLICT (palavra) DO NOTHING;

-- BEFORE INSERT: roda no banco, não dá pra ser contornado indo direto na API. Se achar
-- alguma palavra da lista no texto, a resenha é publicada como OCULTA (não REMOVIDA —
-- staff pode revisar e restaurar se for falso positivo, ex.: "classificados" tem
-- "idiota" dentro por coincidência nenhuma real, mas o ponto é: nunca perde o texto,
-- só não fica visível até alguém confirmar).
CREATE OR REPLACE FUNCTION public.fn_filtrar_resenha()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM palavras_proibidas p
    WHERE p.ativo = true AND NEW.texto ILIKE '%' || p.palavra || '%'
  ) THEN
    NEW.status := 'OCULTA';
    NEW.motivo_ocultacao := 'Filtro automático de linguagem — aguardando revisão da equipe.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_filtrar_resenha ON resenhas;
CREATE TRIGGER trg_filtrar_resenha
  BEFORE INSERT ON resenhas
  FOR EACH ROW EXECUTE FUNCTION public.fn_filtrar_resenha();

-- ------------------------------------------------------------------------------------
-- 2. Aceite mútuo de dupla: a RLS (Fase 1) já deixa qualquer um dos dois lados
--    (aluno_a OU aluno_b) atualizar a linha — o que ela NÃO garante sozinha é que
--    especificamente quem CONVIDOU não possa "aceitar" o próprio convite. Esse
--    trigger fecha essa brecha: só quem foi convidado (o lado que não é
--    solicitado_por) pode fazer a transição PENDENTE -> ACEITA. Staff (que não tem
--    meu_aluno_id()) continua podendo ajustar administrativamente se precisar.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_dupla_valida_aceite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ACEITA' AND OLD.status = 'PENDENTE' THEN
    IF public.meu_aluno_id() = OLD.solicitado_por THEN
      RAISE EXCEPTION 'Quem convidou não pode aceitar o próprio convite — é preciso o outro aluno aceitar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dupla_valida_aceite ON duplas;
CREATE TRIGGER trg_dupla_valida_aceite
  BEFORE UPDATE ON duplas
  FOR EACH ROW EXECUTE FUNCTION public.fn_dupla_valida_aceite();

DROP TRIGGER IF EXISTS trg_auditoria_palavras_proibidas ON palavras_proibidas;
CREATE TRIGGER trg_auditoria_palavras_proibidas
  AFTER INSERT OR UPDATE OR DELETE ON palavras_proibidas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();
