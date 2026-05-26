import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hqonnxnwozfwkpqgabpf.supabase.co';
// Using service role key would be needed for DDL. Since we only have anon key,
// we print the SQL for manual execution.

const sql = `
-- Execute no Supabase Dashboard > SQL Editor
CREATE TABLE IF NOT EXISTS calendario_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  categoria text NOT NULL,
  abreviacao text DEFAULT '',
  descricao text DEFAULT '',
  criado_por text DEFAULT '',
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE calendario_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura autenticada" ON calendario_eventos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escrita por autenticados" ON calendario_eventos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;

console.log('=== SQL PARA EXECUTAR NO SUPABASE DASHBOARD ===');
console.log(sql);
console.log('================================================');
console.log('URL: https://supabase.com/dashboard/project/hqonnxnwozfwkpqgabpf/sql/new');
