-- ====================================================================================
-- BIBLIOTECA — Autocadastro (BiblioClube): buscar o aluno na matrícula durante o
-- próprio formulário, em vez de aceitar um nome digitado livremente.
--
-- Hoje `nome_informado` é texto livre — qualquer pessoa (sem vínculo nenhum com a
-- escola) consegue preencher um nome inventado e enviar o pedido; só na aprovação da
-- Secretaria é que existe uma checagem de verdade. Isso adiciona uma barreira na
-- ORIGEM: o aluno digita e só pode prosseguir escolhendo um nome que já existe na
-- matrícula.
--
-- Por que uma RPC nova em vez de reaproveitar a leitura direta de `alunos` (como
-- buscarAlunos() já faz para BIBLIOTECA/SECRETARIA): neste momento do fluxo o
-- requerente pode nem ter sessão ainda (é chamado ANTES do signUp, enquanto ele digita
-- o nome) — precisa ser callable por `anon`, e só pode devolver o mínimo necessário
-- pra reconhecer o próprio nome (nome + turma), nunca data de nascimento, responsável
-- etc. (ver create_biblioteca_cadastro_pendente.sql sobre minimização de dado).
-- ====================================================================================

-- Nota: alunos.status usa 'Ativo' (capitalizado), não 'ATIVO' -- mesmo engano já
-- existia em bibliotecaService.buscarAlunos() (corrigido junto com esta migração).
DROP FUNCTION IF EXISTS public.rpc_buscar_alunos_matricula(TEXT);
CREATE OR REPLACE FUNCTION public.rpc_buscar_alunos_matricula(p_busca TEXT)
RETURNS TABLE (id UUID, nome TEXT, turma_id UUID, turma_nome TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.nome, a.turma_id, t.nome AS turma_nome
  FROM alunos a
  LEFT JOIN turmas t ON t.id = a.turma_id
  WHERE a.status = 'Ativo'
    AND a.nome ILIKE '%' || trim(p_busca) || '%'
  ORDER BY a.nome
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.rpc_buscar_alunos_matricula(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_buscar_alunos_matricula(TEXT) TO anon, authenticated;

-- Guarda qual aluno o requerente selecionou (sugestão, não vínculo definitivo — quem
-- decide continua sendo a Secretaria na aprovação, mesmo espírito do resto do fluxo:
-- ver comentário grande em create_biblioteca_cadastro_pendente.sql sobre o porquê da
-- aprovação humana existir).
ALTER TABLE cadastros_biblioteca_pendentes
  ADD COLUMN IF NOT EXISTS aluno_id_sugerido UUID REFERENCES alunos(id);
