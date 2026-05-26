-- Script de correção de RLS para o primeiro acesso
-- Copie e cole este código no SQL Editor do Supabase e clique em "Run"

-- 1. Permite que usuários autenticados vejam seus próprios perfis baseados no e-mail, 
-- mesmo que o user_id ainda não tenha sido vinculado
CREATE POLICY "Permitir select por email durante login" 
ON public.professores 
FOR SELECT 
TO authenticated 
USING (
  email = (auth.jwt() ->> 'email')::text 
  OR user_id = auth.uid()
);

-- 2. Permite que o usuário no primeiro acesso faça o "update" do seu próprio user_id
CREATE POLICY "Permitir auto-vinculacao no primeiro acesso" 
ON public.professores 
FOR UPDATE 
TO authenticated 
USING (
  email = (auth.jwt() ->> 'email')::text 
  AND user_id IS NULL
)
WITH CHECK (
  email = (auth.jwt() ->> 'email')::text
);

-- Opcional: Se desejar forçar a vinculação deste inspetor específico agora sem que ele precise recadastrar
UPDATE public.professores 
SET user_id = (SELECT id FROM auth.users WHERE email = 'dokewa9886@getasail.com' LIMIT 1)
WHERE email = 'dokewa9886@getasail.com' AND user_id IS NULL;
