-- =====================================================================
-- MIGRATION: Criar tabela de mensagens da coordenação para professores
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- =====================================================================

CREATE TABLE IF NOT EXISTS mensagens_coordenacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  destinatario_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  conteudo TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  data_leitura TIMESTAMP WITH TIME ZONE,
  grupo_id UUID, -- UUID comum para mensagens enviadas em lote (broadcast)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Realtime para esta tabela (permite atualizações em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens_coordenacao;
