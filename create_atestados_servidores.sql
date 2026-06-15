-- ============================================================
-- MIGRAÇÃO: Sistema de Atestado com Espelhamento de Turmas
-- Portal JBR — Gestão Escolar
-- ============================================================

-- 1. Tabela principal de atestados
CREATE TABLE IF NOT EXISTS atestados_servidores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  professor_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  substituto_id UUID REFERENCES professores(id) ON DELETE SET NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT data_fim_maior CHECK (data_fim >= data_inicio)
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_atestados_professor ON atestados_servidores(professor_id);
CREATE INDEX IF NOT EXISTS idx_atestados_substituto ON atestados_servidores(substituto_id);
CREATE INDEX IF NOT EXISTS idx_atestados_ativo ON atestados_servidores(ativo);
CREATE INDEX IF NOT EXISTS idx_atestados_datas ON atestados_servidores(data_inicio, data_fim);

-- RLS
ALTER TABLE atestados_servidores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso publico atestados" ON atestados_servidores FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_atestados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atestados_updated_at
  BEFORE UPDATE ON atestados_servidores
  FOR EACH ROW EXECUTE FUNCTION update_atestados_updated_at();


-- ============================================================
-- 2. Adicionar colunas de espelhamento na tabela alocacoes_v2
-- ============================================================

ALTER TABLE alocacoes_v2
  ADD COLUMN IF NOT EXISTS is_espelho BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS atestado_id UUID REFERENCES atestados_servidores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS professor_original_id UUID REFERENCES professores(id) ON DELETE CASCADE;

-- Índice para buscar espelhos de um atestado
CREATE INDEX IF NOT EXISTS idx_alocacoes_espelho ON alocacoes_v2(is_espelho) WHERE is_espelho = TRUE;
CREATE INDEX IF NOT EXISTS idx_alocacoes_atestado ON alocacoes_v2(atestado_id) WHERE atestado_id IS NOT NULL;


-- ============================================================
-- 3. Função utilitária: criar espelhos de um atestado
-- ============================================================

CREATE OR REPLACE FUNCTION criar_espelhos_atestado(p_atestado_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_atestado RECORD;
  v_alocacao RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Buscar o atestado
  SELECT * INTO v_atestado
  FROM atestados_servidores
  WHERE id = p_atestado_id AND ativo = TRUE AND substituto_id IS NOT NULL;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Percorrer alocações do professor afastado
  FOR v_alocacao IN
    SELECT * FROM alocacoes_v2
    WHERE professor_id = v_atestado.professor_id
      AND (is_espelho = FALSE OR is_espelho IS NULL)
  LOOP
    -- Inserir espelho apenas se não existir
    INSERT INTO alocacoes_v2 (professor_id, turma_id, disciplina_id, is_espelho, atestado_id, professor_original_id)
    VALUES (v_atestado.substituto_id, v_alocacao.turma_id, v_alocacao.disciplina_id, TRUE, p_atestado_id, v_atestado.professor_id)
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 4. Função utilitária: remover espelhos de um atestado
-- ============================================================

CREATE OR REPLACE FUNCTION remover_espelhos_atestado(p_atestado_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM alocacoes_v2
  WHERE atestado_id = p_atestado_id AND is_espelho = TRUE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 5. Função de limpeza: expirar atestados vencidos
-- ============================================================

CREATE OR REPLACE FUNCTION expirar_atestados_vencidos()
RETURNS TEXT AS $$
DECLARE
  v_atestado RECORD;
  v_removidos INTEGER := 0;
  v_expirados INTEGER := 0;
BEGIN
  FOR v_atestado IN
    SELECT id FROM atestados_servidores
    WHERE ativo = TRUE AND data_fim < CURRENT_DATE
  LOOP
    -- Remove espelhos
    v_removidos := v_removidos + remover_espelhos_atestado(v_atestado.id);
    
    -- Marca como inativo
    UPDATE atestados_servidores SET ativo = FALSE WHERE id = v_atestado.id;
    v_expirados := v_expirados + 1;
  END LOOP;

  RETURN FORMAT('Atestados expirados: %s | Espelhos removidos: %s', v_expirados, v_removidos);
END;
$$ LANGUAGE plpgsql;
