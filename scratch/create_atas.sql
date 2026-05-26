-- Criação das tabelas para o Sistema de Atas

-- 1. Tabela de Modelos de Atas (Templates)
CREATE TABLE public.atas_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo text NOT NULL,
    conteudo text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.atas_templates ENABLE ROW LEVEL SECURITY;

-- Permitir leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura de templates para todos" 
ON public.atas_templates FOR SELECT 
TO authenticated 
USING (true);

-- Permitir inserção, edição e exclusão apenas para gestores
CREATE POLICY "Permitir gerenciar templates para gestores" 
ON public.atas_templates FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.professores 
        WHERE professores.user_id = auth.uid() 
        AND (professores.cargo = 'Diretor' OR professores.cargo = 'Coordenador')
    )
);

-- Inserir o primeiro template padrão
INSERT INTO public.atas_templates (titulo, conteudo) 
VALUES (
    'Ata nº 01', 
    'Aos [DATA], reuniu-se a coordenação pedagógica da E.E. José Barbosa Rodrigues para deliberar sobre o comportamento e desempenho acadêmico do(a) estudante {{NOME_ALUNO}}. O(a) responsável foi devidamente orientado(a) sobre as normas do regimento escolar e as sanções previstas em caso de reincidência. 

Compromissos firmados:
1. Acompanhamento diário das tarefas escolares.
2. Frequência regular e pontualidade.

Nada mais havendo a tratar, lavrou-se a presente ata que, após lida e aprovada, segue assinada pelos presentes.

___________________________________________________
Assinatura do(a) Responsável

___________________________________________________
Coordenação Pedagógica'
);


-- 2. Tabela de Atas Emitidas para Alunos
CREATE TABLE public.atas_alunos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id text NOT NULL,
    template_id uuid REFERENCES public.atas_templates(id),
    titulo text NOT NULL,
    conteudo_gerado text NOT NULL,
    imagem_assinatura_url text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.atas_alunos ENABLE ROW LEVEL SECURITY;

-- Permitir leitura e inserção para todos os usuários autenticados
CREATE POLICY "Permitir leitura e criacao de atas para todos" 
ON public.atas_alunos FOR ALL 
TO authenticated 
USING (true);


-- 3. Configuração do Storage (Armazenamento de Imagens/PDFs)
-- Importante: Vá até "Storage" no Supabase e crie um novo bucket chamado "atas_assinadas".
-- Se não conseguir rodar essas políticas de storage por aqui, configure-as na tela do Supabase:
-- Permitir upload para usuários autenticados e leitura para todos autenticados.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('atas_assinadas', 'atas_assinadas', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Permitir upload de atas" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'atas_assinadas' );

CREATE POLICY "Permitir leitura de atas" 
ON storage.objects FOR SELECT 
TO authenticated 
USING ( bucket_id = 'atas_assinadas' );

CREATE POLICY "Permitir atualizacao de atas" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'atas_assinadas' );
