-- Verifique se há RLS ativo na tabela professores e quais políticas existem
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'professores';

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'professores';
