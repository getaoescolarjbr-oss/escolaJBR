-- Agenda pública da Landing Page (cards Lab. Ciências / Lab. Informática / Quadra e o
-- link ?modulo=agendamento&recurso=<id>). fechar_exposicao_anon.sql fechou a tabela
-- recursos e get_disponibilidade para o anônimo, o que derrubou essa agenda (os cards
-- abriam "em breve" e o console mostrava "permission denied for table recursos").
-- Em vez de reabrir a tabela, expõe só o necessário:
--   - rpc_recursos_publicos: dados descritivos dos recursos ATIVOS (sem capacidade,
--     regras de aprovação etc.);
--   - get_disponibilidade: já devolve só data/hora/tipo (RESERVA ou BLOQUEIO), sem
--     professor, turma ou finalidade — liberada para o anônimo como estava antes.
-- (Já aplicado no banco.)
CREATE OR REPLACE FUNCTION public.rpc_recursos_publicos()
RETURNS TABLE(id UUID, nome TEXT, tipo TEXT, local TEXT, cor TEXT, icone TEXT, ordem INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.nome, r.tipo::text, r.local, r.cor, r.icone, r.ordem
  FROM public.recursos r
  WHERE r.ativo = true
  ORDER BY r.ordem, r.nome;
$$;

REVOKE ALL ON FUNCTION public.rpc_recursos_publicos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_recursos_publicos() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_disponibilidade(uuid, date, date) TO anon;
