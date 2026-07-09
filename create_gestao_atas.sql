-- ====================================================================================
-- GESTÃO ESCOLAR — Fase 5a: Atas. Retrofit do recurso legado (atas_alunos/
-- atas_templates/configuracoes_escola), que já existe e está em uso — NÃO recriado do
-- zero. Três problemas reais encontrados na auditoria, corrigidos aqui:
--   1) RLS de atas_alunos era `USING (true)` para tudo — qualquer autenticado lia/
--      escrevia/apagava qualquer ata. atas_templates usava check de professores.cargo
--      (padrão antigo, não usuario_tem_papel). configuracoes_escola era "allow all".
--   2) numero_sequencial era calculado no CLIENTE (`order by desc limit 1, +1`) — a
--      mesma race condition que o mecanismo de numeração da Secretaria já resolve.
--   3) atas_alunos.aluno_id era TEXT (um UUID guardado como string), sem FK de verdade
--      pra alunos — impedia embed do PostgREST e não travava integridade referencial.
--
-- Confirmei antes de mexer: só 1 ata real existe hoje, e todo Coordenador/Diretor/
-- Vice-Diretor com login já tem o papel COORDENACAO/GESTAO (backfill_fundacao_papeis
-- .sql) — travar por usuario_tem_papel não bloqueia ninguém que já usa isto.
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- 1. aluno_id: TEXT -> UUID de verdade, com FK. O valor já É um UUID válido (só a
--    coluna era do tipo errado), então a conversão é direta.
-- ------------------------------------------------------------------------------------
ALTER TABLE atas_alunos ALTER COLUMN aluno_id TYPE UUID USING aluno_id::uuid;
ALTER TABLE atas_alunos ADD CONSTRAINT atas_alunos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES alunos(id);

-- ------------------------------------------------------------------------------------
-- 2. ano_letivo: não existia. Backfill pela data da ata já existente; daqui pra frente
--    a RPC de emissão sempre define explicitamente. UNIQUE(ano_letivo, numero_sequencial)
--    é a garantia de integridade em repouso, além da atomicidade na hora de gerar.
-- ------------------------------------------------------------------------------------
ALTER TABLE atas_alunos ADD COLUMN IF NOT EXISTS ano_letivo INTEGER;
UPDATE atas_alunos SET ano_letivo = extract(year FROM data_ata)::int WHERE ano_letivo IS NULL AND data_ata IS NOT NULL;
UPDATE atas_alunos SET ano_letivo = extract(year FROM created_at)::int WHERE ano_letivo IS NULL;
ALTER TABLE atas_alunos ALTER COLUMN ano_letivo SET NOT NULL;
ALTER TABLE atas_alunos ADD CONSTRAINT atas_alunos_ano_numero_unique UNIQUE (ano_letivo, numero_sequencial);

-- Seed do contador a partir do que já existe: sem isto, a primeira chamada de
-- rpc_emitir_ata pra um ano_letivo com atas legadas (ex.: 2026) começaria do 1 de novo
-- e colidiria com a unique constraint acima (detectado ao verificar ao vivo antes de
-- liberar a RPC pro cliente).
INSERT INTO contadores_documentos (tipo, ano, ultimo_numero)
SELECT 'ATA', ano_letivo, MAX(numero_sequencial) FROM atas_alunos GROUP BY ano_letivo
ON CONFLICT (tipo, ano) DO UPDATE SET ultimo_numero = GREATEST(contadores_documentos.ultimo_numero, EXCLUDED.ultimo_numero);

-- ------------------------------------------------------------------------------------
-- 3. RLS — substitui "true" por usuario_tem_papel. Leitura e escrita de atas_alunos
--    ficam GESTAO/COORDENACAO (é quem já gerencia isso hoje). Sem policy de INSERT
--    direto: só a RPC rpc_emitir_ata cria uma ata nova (garante o número atômico);
--    UPDATE continua liberado por RLS pra edição de conteúdo/anulação/assinatura
--    (não tem risco de concorrência, é só texto/flag).
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permitir leitura e criacao de atas para todos" ON atas_alunos;

DROP POLICY IF EXISTS "atas_alunos_select" ON atas_alunos;
CREATE POLICY "atas_alunos_select" ON atas_alunos FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

DROP POLICY IF EXISTS "atas_alunos_update" ON atas_alunos;
CREATE POLICY "atas_alunos_update" ON atas_alunos FOR UPDATE TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

DROP POLICY IF EXISTS "atas_alunos_delete" ON atas_alunos;
CREATE POLICY "atas_alunos_delete" ON atas_alunos FOR DELETE TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

DROP TRIGGER IF EXISTS trg_auditoria_atas_alunos ON atas_alunos;
CREATE TRIGGER trg_auditoria_atas_alunos
  AFTER INSERT OR UPDATE OR DELETE ON atas_alunos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- atas_templates: mesmo padrão (troca o check de professores.cargo por usuario_tem_papel).
-- Nomes reais confirmados via pg_policies antes de aplicar (não os que eu supus à primeira vista).
DROP POLICY IF EXISTS "Permitir gerenciar templates para gestores" ON atas_templates;
DROP POLICY IF EXISTS "Permitir leitura de templates para todos" ON atas_templates;
DROP POLICY IF EXISTS "atas_templates_select" ON atas_templates;
CREATE POLICY "atas_templates_select" ON atas_templates FOR SELECT TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

DROP POLICY IF EXISTS "atas_templates_write" ON atas_templates;
CREATE POLICY "atas_templates_write" ON atas_templates FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

DROP TRIGGER IF EXISTS trg_auditoria_atas_templates ON atas_templates;
CREATE TRIGGER trg_auditoria_atas_templates
  AFTER INSERT OR UPDATE OR DELETE ON atas_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- configuracoes_escola: leitura para qualquer autenticado (chaves de config em geral
-- não são sensíveis), escrita só GESTAO/COORDENACAO. Está vazia hoje — sem risco de
-- quebrar outra funcionalidade que dependa de "allow all" aqui.
DROP POLICY IF EXISTS "Allow all" ON configuracoes_escola;
DROP POLICY IF EXISTS "configuracoes_escola_select" ON configuracoes_escola;
CREATE POLICY "configuracoes_escola_select" ON configuracoes_escola FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "configuracoes_escola_write" ON configuracoes_escola;
CREATE POLICY "configuracoes_escola_write" ON configuracoes_escola FOR ALL TO authenticated
  USING (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  WITH CHECK (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

DROP TRIGGER IF EXISTS trg_auditoria_configuracoes_escola ON configuracoes_escola;
CREATE TRIGGER trg_auditoria_configuracoes_escola
  AFTER INSERT OR UPDATE OR DELETE ON configuracoes_escola
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------------------------------
-- 4. Emissão de ata — reaproveita fn_proximo_numero_documento (mesmo mecanismo da
--    Secretaria), chaveado por ('ATA', ano_letivo) — numeração POR ANO LETIVO, como
--    pedido. Registra EXPORT em auditoria (mesmo raciocínio de rpc_emitir_documento:
--    emitir uma ata com dado do aluno é, em si, uma exportação de dado pessoal).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_emitir_ata(
  p_aluno_id UUID,
  p_template_id UUID,
  p_titulo TEXT,
  p_conteudo_gerado TEXT,
  p_data_ata DATE,
  p_acordado TEXT,
  p_bimestre_id INTEGER,
  p_ano_letivo INTEGER
)
RETURNS atas_alunos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INTEGER;
  v_row atas_alunos;
  v_pessoa_id UUID;
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')) THEN
    RAISE EXCEPTION 'Sem permissão para emitir atas.' USING ERRCODE = '42501';
  END IF;

  v_numero := public.fn_proximo_numero_documento('ATA', p_ano_letivo);

  INSERT INTO atas_alunos (aluno_id, template_id, titulo, conteudo_gerado, data_ata, acordado, bimestre_id, ano_letivo, numero_sequencial, created_by)
  VALUES (p_aluno_id, p_template_id, p_titulo, p_conteudo_gerado, p_data_ata, p_acordado, p_bimestre_id, p_ano_letivo, v_numero, auth.uid())
  RETURNING * INTO v_row;

  SELECT pessoa_id INTO v_pessoa_id FROM alunos WHERE id = p_aluno_id;
  INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, pessoa_afetada_id, campos_alterados)
  VALUES (auth.uid(), 'EXPORT', 'atas_alunos', v_row.id, v_pessoa_id, ARRAY['emissao_ata']);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_emitir_ata(UUID, UUID, TEXT, TEXT, DATE, TEXT, INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_emitir_ata(UUID, UUID, TEXT, TEXT, DATE, TEXT, INTEGER, INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------------
-- 5. Seed do número inicial (substitui o uso indireto de configuracoes_escola pra
--    isto): só funciona ANTES da primeira ata do ano ser emitida — depois disso, é
--    ajuste manual consciente, não um "reset" acidental que geraria número repetido.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_definir_numero_inicial_ata(p_ano_letivo INTEGER, p_numero_inicial INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO')) THEN
    RAISE EXCEPTION 'Sem permissão para definir numeração de atas.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM atas_alunos WHERE ano_letivo = p_ano_letivo) THEN
    RAISE EXCEPTION 'Já existem atas emitidas para %; não é possível redefinir o número inicial (evita duplicidade futura).', p_ano_letivo;
  END IF;

  INSERT INTO contadores_documentos (tipo, ano, ultimo_numero)
  VALUES ('ATA', p_ano_letivo, p_numero_inicial - 1)
  ON CONFLICT (tipo, ano) DO UPDATE SET ultimo_numero = p_numero_inicial - 1;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_definir_numero_inicial_ata(INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_definir_numero_inicial_ata(INTEGER, INTEGER) TO authenticated;
