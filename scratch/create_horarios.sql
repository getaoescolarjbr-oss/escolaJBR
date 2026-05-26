-- Execute isso no SQL Editor do Supabase para criar a tabela de horários
CREATE TABLE public.horarios (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    professor_id uuid NOT NULL REFERENCES public.professores(id) ON DELETE CASCADE,
    turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
    dia_semana integer NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
    tempo integer NOT NULL CHECK (tempo BETWEEN 1 AND 8),
    disciplina_nome text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Permitir leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura de horários para usuários autenticados" 
ON public.horarios FOR SELECT 
TO authenticated 
USING (true);

-- Permitir inserção para gestores
CREATE POLICY "Permitir insert para gestores" 
ON public.horarios FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.professores 
        WHERE professores.user_id = auth.uid() 
        AND (professores.cargo = 'Diretor' OR professores.cargo = 'Coordenador')
    )
);

-- Permitir update para gestores
CREATE POLICY "Permitir update para gestores" 
ON public.horarios FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.professores 
        WHERE professores.user_id = auth.uid() 
        AND (professores.cargo = 'Diretor' OR professores.cargo = 'Coordenador')
    )
);

-- Permitir delete para gestores
CREATE POLICY "Permitir delete para gestores" 
ON public.horarios FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.professores 
        WHERE professores.user_id = auth.uid() 
        AND (professores.cargo = 'Diretor' OR professores.cargo = 'Coordenador')
    )
);
