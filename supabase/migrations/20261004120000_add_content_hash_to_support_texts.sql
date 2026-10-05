-- Adiciona coluna content_hash para otimizar buscas de textos duplicados
-- Evita URLs gigantes ao comparar textos muito longos
ALTER TABLE support_texts
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Popula o hash para registros existentes
UPDATE support_texts
SET content_hash = encode(digest(content, 'sha256'), 'hex')
WHERE content_hash IS NULL;

-- Cria índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_support_texts_content_hash ON support_texts(content_hash);
