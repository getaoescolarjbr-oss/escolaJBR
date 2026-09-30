-- Reverte create_cadastro_servidor_com_aprovacao.sql.
-- ATENÇÃO: apagar a tabela descarta os pedidos pendentes. Rode só se nenhum estiver em análise.

DROP FUNCTION IF EXISTS public.rpc_aprovar_cadastro_servidor(UUID, papel_usuario);
DROP FUNCTION IF EXISTS public.rpc_rejeitar_cadastro_servidor(UUID, TEXT);
DROP TABLE IF EXISTS cadastros_servidores_pendentes;

-- Política de INSERT em professores como estava antes (PERMISSIVA, papel public).
DROP POLICY IF EXISTS "professores_insert_gestao" ON professores;
CREATE POLICY "professores_insert_gestao" ON professores FOR INSERT TO public
  WITH CHECK (
    (SELECT usuario_tem_papel('GESTAO'::papel_usuario))
    OR (SELECT usuario_tem_papel('SECRETARIA'::papel_usuario))
    OR (email = ((SELECT auth.jwt()) ->> 'email'))
  );
