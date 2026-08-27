  -- ====================================================================================
  -- AVALIAÇÕES — gerador de provas/simulados a partir do Banco de Questões, com opção de
  -- aplicação impressa e/ou online. A parte online usa a mesma conta de aluno já
  -- existente do BiblioClube (login por usuário+senha, aprovado pela Secretaria — ver
  -- create_biblioteca_cadastro_pendente.sql / create_biblioteca_fase4.sql). Segue as
  -- mesmas convenções do resto do projeto: usuario_tem_papel(), update_updated_at_column()
  -- (já criada em create_banco_questoes_schema.sql), RLS por tabela, RPCs SECURITY DEFINER
  -- para qualquer leitura/escrita que precise atravessar papéis.
  --
  -- PONTO CRÍTICO DE SEGURANÇA: o aluno nunca pode ler `questions.correct_letter` antes
  -- de responder. Hoje `questions` já é ilegível para o papel ALUNO (só
  -- PROFESSOR/COORDENACAO/GESTAO no create_banco_questoes_schema.sql), então o aluno
  -- só acessa as questões de uma avaliação através de rpc_questoes_avaliacao_aluno,
  -- que devolve as colunas sem gabarito. A correção é feita 100% no servidor, dentro de
  -- rpc_submeter_resposta_avaliacao.
  -- ====================================================================================

  CREATE TABLE IF NOT EXISTS public.avaliacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  );
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS titulo text;
  DELETE FROM public.avaliacoes WHERE titulo IS NULL;
  ALTER TABLE public.avaliacoes ALTER COLUMN titulo SET NOT NULL;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS disciplina text;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS instrucoes text;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS valor_total numeric(5,2) NOT NULL DEFAULT 10;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'IMPRESSA';
  DO $$ BEGIN
    ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_modo_check CHECK (modo IN ('IMPRESSA', 'ONLINE', 'AMBAS'));
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS data_aplicacao date;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS prazo_entrega timestamptz;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'RASCUNHO';
  DO $$ BEGIN
    ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_status_check CHECK (status IN ('RASCUNHO', 'PUBLICADA', 'ENCERRADA'));
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id);
  DELETE FROM public.avaliacoes WHERE criado_por IS NULL;
  ALTER TABLE public.avaliacoes ALTER COLUMN criado_por SET NOT NULL;
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  ALTER TABLE public.avaliacoes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

  CREATE TABLE IF NOT EXISTS public.avaliacao_questoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  );
  ALTER TABLE public.avaliacao_questoes ADD COLUMN IF NOT EXISTS avaliacao_id uuid REFERENCES public.avaliacoes(id) ON DELETE CASCADE;
  ALTER TABLE public.avaliacao_questoes ALTER COLUMN avaliacao_id SET NOT NULL;
  ALTER TABLE public.avaliacao_questoes ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.questions(id);
  ALTER TABLE public.avaliacao_questoes ALTER COLUMN question_id SET NOT NULL;
  ALTER TABLE public.avaliacao_questoes ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;
  ALTER TABLE public.avaliacao_questoes ADD COLUMN IF NOT EXISTS valor numeric(5,2) NOT NULL DEFAULT 0;
  DO $$ BEGIN
    ALTER TABLE public.avaliacao_questoes ADD CONSTRAINT avaliacao_questoes_avaliacao_id_question_id_key UNIQUE (avaliacao_id, question_id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE TABLE IF NOT EXISTS public.avaliacao_turmas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  );
  ALTER TABLE public.avaliacao_turmas ADD COLUMN IF NOT EXISTS avaliacao_id uuid REFERENCES public.avaliacoes(id) ON DELETE CASCADE;
  ALTER TABLE public.avaliacao_turmas ALTER COLUMN avaliacao_id SET NOT NULL;
  ALTER TABLE public.avaliacao_turmas ADD COLUMN IF NOT EXISTS turma_id uuid REFERENCES public.turmas(id);
  ALTER TABLE public.avaliacao_turmas ALTER COLUMN turma_id SET NOT NULL;
  DO $$ BEGIN
    ALTER TABLE public.avaliacao_turmas ADD CONSTRAINT avaliacao_turmas_avaliacao_id_turma_id_key UNIQUE (avaliacao_id, turma_id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE TABLE IF NOT EXISTS public.avaliacao_respostas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  );
  ALTER TABLE public.avaliacao_respostas ADD COLUMN IF NOT EXISTS avaliacao_id uuid REFERENCES public.avaliacoes(id) ON DELETE CASCADE;
  ALTER TABLE public.avaliacao_respostas ALTER COLUMN avaliacao_id SET NOT NULL;
  ALTER TABLE public.avaliacao_respostas ADD COLUMN IF NOT EXISTS aluno_id uuid REFERENCES public.alunos(id);
  ALTER TABLE public.avaliacao_respostas ALTER COLUMN aluno_id SET NOT NULL;
  ALTER TABLE public.avaliacao_respostas ADD COLUMN IF NOT EXISTS iniciado_em timestamptz NOT NULL DEFAULT now();
  ALTER TABLE public.avaliacao_respostas ADD COLUMN IF NOT EXISTS finalizado_em timestamptz;
  ALTER TABLE public.avaliacao_respostas ADD COLUMN IF NOT EXISTS nota numeric(5,2);
  DO $$ BEGIN
    ALTER TABLE public.avaliacao_respostas ADD CONSTRAINT avaliacao_respostas_avaliacao_id_aluno_id_key UNIQUE (avaliacao_id, aluno_id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE TABLE IF NOT EXISTS public.avaliacao_respostas_itens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  );
  ALTER TABLE public.avaliacao_respostas_itens ADD COLUMN IF NOT EXISTS resposta_id uuid REFERENCES public.avaliacao_respostas(id) ON DELETE CASCADE;
  ALTER TABLE public.avaliacao_respostas_itens ALTER COLUMN resposta_id SET NOT NULL;
  ALTER TABLE public.avaliacao_respostas_itens ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.questions(id);
  ALTER TABLE public.avaliacao_respostas_itens ALTER COLUMN question_id SET NOT NULL;
  ALTER TABLE public.avaliacao_respostas_itens ADD COLUMN IF NOT EXISTS letra_marcada text;
  ALTER TABLE public.avaliacao_respostas_itens ADD COLUMN IF NOT EXISTS correta boolean NOT NULL DEFAULT false;
  ALTER TABLE public.avaliacao_respostas_itens ADD COLUMN IF NOT EXISTS valor_obtido numeric(5,2) NOT NULL DEFAULT 0;
  DO $$ BEGIN
    ALTER TABLE public.avaliacao_respostas_itens ADD CONSTRAINT avaliacao_respostas_itens_resposta_id_question_id_key UNIQUE (resposta_id, question_id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS avaliacoes_criado_por_idx ON public.avaliacoes (criado_por);
  CREATE INDEX IF NOT EXISTS avaliacao_questoes_avaliacao_id_idx ON public.avaliacao_questoes (avaliacao_id);
  CREATE INDEX IF NOT EXISTS avaliacao_turmas_avaliacao_id_idx ON public.avaliacao_turmas (avaliacao_id);
  CREATE INDEX IF NOT EXISTS avaliacao_turmas_turma_id_idx ON public.avaliacao_turmas (turma_id);
  CREATE INDEX IF NOT EXISTS avaliacao_respostas_aluno_id_idx ON public.avaliacao_respostas (aluno_id);
  CREATE INDEX IF NOT EXISTS avaliacao_respostas_itens_resposta_id_idx ON public.avaliacao_respostas_itens (resposta_id);

  DROP TRIGGER IF EXISTS trg_avaliacoes_updated_at ON public.avaliacoes;
  CREATE TRIGGER trg_avaliacoes_updated_at
    BEFORE UPDATE ON public.avaliacoes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

  GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes, public.avaliacao_questoes, public.avaliacao_turmas TO authenticated;
  GRANT SELECT ON public.avaliacao_respostas, public.avaliacao_respostas_itens TO authenticated;
  GRANT ALL ON public.avaliacoes, public.avaliacao_questoes, public.avaliacao_turmas, public.avaliacao_respostas, public.avaliacao_respostas_itens TO service_role;

  ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.avaliacao_questoes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.avaliacao_turmas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.avaliacao_respostas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.avaliacao_respostas_itens ENABLE ROW LEVEL SECURITY;

  -- avaliacoes: dono (professor/coordenação que criou) e GESTAO têm controle total;
  -- COORDENACAO lê tudo (supervisão pedagógica) mas só edita/apaga a própria. ALUNO não
  -- tem policy nenhuma aqui de propósito — só enxerga avaliação via as RPCs abaixo.
  DROP POLICY IF EXISTS "avaliacoes_select_dono_ou_staff" ON public.avaliacoes;
  CREATE POLICY "avaliacoes_select_dono_ou_staff"
    ON public.avaliacoes FOR SELECT TO authenticated
    USING (criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'));

  DROP POLICY IF EXISTS "avaliacoes_insert_professor_coordenacao_gestao" ON public.avaliacoes;
  CREATE POLICY "avaliacoes_insert_professor_coordenacao_gestao"
    ON public.avaliacoes FOR INSERT TO authenticated
    WITH CHECK (
      criado_por = auth.uid()
      AND (public.usuario_tem_papel('PROFESSOR') OR public.usuario_tem_papel('COORDENACAO') OR public.usuario_tem_papel('GESTAO'))
    );

  DROP POLICY IF EXISTS "avaliacoes_update_dono_ou_gestao" ON public.avaliacoes;
  CREATE POLICY "avaliacoes_update_dono_ou_gestao"
    ON public.avaliacoes FOR UPDATE TO authenticated
    USING (criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
    WITH CHECK (criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'));

  DROP POLICY IF EXISTS "avaliacoes_delete_dono_ou_gestao" ON public.avaliacoes;
  CREATE POLICY "avaliacoes_delete_dono_ou_gestao"
    ON public.avaliacoes FOR DELETE TO authenticated
    USING (criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'));

  -- avaliacao_questoes / avaliacao_turmas: mesma regra de acesso da avaliação-mãe.
  DROP POLICY IF EXISTS "avaliacao_questoes_all_dono_ou_staff" ON public.avaliacao_questoes;
  CREATE POLICY "avaliacao_questoes_all_dono_ou_staff"
    ON public.avaliacao_questoes FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacao_id
        AND (a.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacao_id
        AND (a.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
    ));

  DROP POLICY IF EXISTS "avaliacao_turmas_all_dono_ou_staff" ON public.avaliacao_turmas;
  CREATE POLICY "avaliacao_turmas_all_dono_ou_staff"
    ON public.avaliacao_turmas FOR ALL TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacao_id
        AND (a.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacao_id
        AND (a.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
    ));

  -- avaliacao_respostas / _itens: o professor-dono (e GESTAO/COORDENACAO) vê os
  -- resultados; o próprio aluno vê só a sua resposta. Nenhum papel tem INSERT/UPDATE
  -- direto aqui — a gravação é só via rpc_submeter_resposta_avaliacao (SECURITY
  -- DEFINER), pra garantir que a nota sempre é calculada no servidor.
  DROP POLICY IF EXISTS "avaliacao_respostas_select_dono_staff_ou_proprio_aluno" ON public.avaliacao_respostas;
  CREATE POLICY "avaliacao_respostas_select_dono_staff_ou_proprio_aluno"
    ON public.avaliacao_respostas FOR SELECT TO authenticated
    USING (
      aluno_id = public.meu_aluno_id()
      OR public.usuario_tem_papel('GESTAO')
      OR public.usuario_tem_papel('COORDENACAO')
      OR EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = avaliacao_id AND a.criado_por = auth.uid())
    );

  DROP POLICY IF EXISTS "avaliacao_respostas_itens_select_dono_staff_ou_proprio_aluno" ON public.avaliacao_respostas_itens;
  CREATE POLICY "avaliacao_respostas_itens_select_dono_staff_ou_proprio_aluno"
    ON public.avaliacao_respostas_itens FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.avaliacao_respostas r WHERE r.id = resposta_id AND (
        r.aluno_id = public.meu_aluno_id()
        OR public.usuario_tem_papel('GESTAO')
        OR public.usuario_tem_papel('COORDENACAO')
        OR EXISTS (SELECT 1 FROM public.avaliacoes a WHERE a.id = r.avaliacao_id AND a.criado_por = auth.uid())
      )
    ));

  -- ------------------------------------------------------------------------------------
  -- turmas.serie_id: a tela de cadastro do aluno passa a pedir Série + Turma (a Turma
  -- filtrada pela Série escolhida). Coluna nova, idempotente — turmas antigas ficam com
  -- serie_id NULL até a Secretaria revisar (não bloqueia nada, só não filtra por série).
  -- ------------------------------------------------------------------------------------
  ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS serie_id uuid REFERENCES public.series_referencia(id);

  -- ------------------------------------------------------------------------------------
  -- E-mail pessoal no autocadastro do aluno: reaproveita a coluna `pessoas.email` já
  -- existente (não cria coluna nova em `alunos`) — na aprovação, se a pessoa já
  -- matriculada ainda não tiver e-mail cadastrado, grava o e-mail pessoal informado.
  -- ------------------------------------------------------------------------------------
  ALTER TABLE public.cadastros_biblioteca_pendentes ADD COLUMN IF NOT EXISTS email_pessoal text;

  CREATE OR REPLACE FUNCTION public.rpc_aprovar_cadastro_biblioteca(p_cadastro_id UUID, p_aluno_id UUID)
  RETURNS cadastros_biblioteca_pendentes
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_cadastro cadastros_biblioteca_pendentes;
    v_pessoa_id UUID;
  BEGIN
    IF NOT (public.usuario_tem_papel('SECRETARIA') OR public.usuario_tem_papel('GESTAO')) THEN
      RAISE EXCEPTION 'Sem permissão para aprovar cadastros da Biblioteca.';
    END IF;

    SELECT * INTO v_cadastro FROM cadastros_biblioteca_pendentes WHERE id = p_cadastro_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cadastro não encontrado.';
    END IF;
    IF v_cadastro.status <> 'PENDENTE' THEN
      RAISE EXCEPTION 'Este cadastro já foi analisado.';
    END IF;

    SELECT pessoa_id INTO v_pessoa_id FROM alunos WHERE id = p_aluno_id;
    IF v_pessoa_id IS NULL THEN
      RAISE EXCEPTION 'O aluno selecionado não tem identidade vinculada (pessoa_id) — regularize o cadastro em Pessoas antes de aprovar.';
    END IF;
    IF EXISTS (SELECT 1 FROM usuarios WHERE pessoa_id = v_pessoa_id) THEN
      RAISE EXCEPTION 'Este aluno já possui um login vinculado.';
    END IF;

    INSERT INTO usuarios (id, pessoa_id, ativo, username)
    VALUES (v_cadastro.auth_user_id, v_pessoa_id, true, v_cadastro.username);

    INSERT INTO usuario_papeis (usuario_id, papel) VALUES (v_cadastro.auth_user_id, 'ALUNO');

    IF v_cadastro.email_pessoal IS NOT NULL AND v_cadastro.email_pessoal <> '' THEN
      UPDATE pessoas SET email = v_cadastro.email_pessoal WHERE id = v_pessoa_id AND (email IS NULL OR email = '');
    END IF;

    INSERT INTO consentimentos (pessoa_id, tipo, aceito, aceito_por_pessoa_id, versao_termo)
    VALUES (v_pessoa_id, 'CADASTRO', v_cadastro.aceite_termos, v_pessoa_id, 'biblioteca-v1');

    UPDATE cadastros_biblioteca_pendentes
      SET status = 'APROVADO', pessoa_id_vinculada = v_pessoa_id, analisado_por = auth.uid(), analisado_em = now()
      WHERE id = p_cadastro_id
      RETURNING * INTO v_cadastro;

    RETURN v_cadastro;
  END;
  $$;

  REVOKE ALL ON FUNCTION public.rpc_aprovar_cadastro_biblioteca(UUID, UUID) FROM public;
  GRANT EXECUTE ON FUNCTION public.rpc_aprovar_cadastro_biblioteca(UUID, UUID) TO authenticated;

  -- ------------------------------------------------------------------------------------
  -- RPCs do lado do aluno — nenhuma delas expõe correct_letter/explanation antes da
  -- submissão.
  -- ------------------------------------------------------------------------------------

  -- Lista as avaliações publicadas/encerradas cuja turma bate com a do aluno logado,
  -- junto do status da resposta dele (sem gabarito nenhum aqui).
  CREATE OR REPLACE FUNCTION public.rpc_minhas_avaliacoes_aluno()
  RETURNS TABLE (
    avaliacao_id uuid,
    titulo text,
    disciplina text,
    valor_total numeric,
    status text,
    prazo_entrega timestamptz,
    data_aplicacao date,
    resposta_status text,
    nota numeric
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT
      av.id,
      av.titulo,
      av.disciplina,
      av.valor_total,
      av.status,
      av.prazo_entrega,
      av.data_aplicacao,
      CASE WHEN r.finalizado_em IS NOT NULL THEN 'ENVIADA' ELSE 'PENDENTE' END,
      r.nota
    FROM avaliacoes av
    JOIN avaliacao_turmas at ON at.avaliacao_id = av.id
    JOIN alunos al ON al.id = public.meu_aluno_id() AND al.turma_id = at.turma_id
    LEFT JOIN avaliacao_respostas r ON r.avaliacao_id = av.id AND r.aluno_id = al.id
    WHERE av.status IN ('PUBLICADA', 'ENCERRADA')
    ORDER BY av.data_aplicacao DESC NULLS LAST, av.created_at DESC;
  $$;

  REVOKE ALL ON FUNCTION public.rpc_minhas_avaliacoes_aluno() FROM public;
  GRANT EXECUTE ON FUNCTION public.rpc_minhas_avaliacoes_aluno() TO authenticated;

  -- Questões de uma avaliação específica, para o aluno responder — confere turma, prazo
  -- e status antes de devolver, e nunca inclui correct_letter/explanation.
  CREATE OR REPLACE FUNCTION public.rpc_questoes_avaliacao_aluno(p_avaliacao_id uuid)
  RETURNS TABLE (
    question_id uuid,
    ordem integer,
    valor numeric,
    statement text,
    image_url text,
    alternatives jsonb,
    support_text_content text,
    support_text_image_url text,
    ja_respondida boolean,
    letra_marcada text
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_aluno_id uuid;
    v_avaliacao avaliacoes;
    v_resposta_id uuid;
  BEGIN
    v_aluno_id := public.meu_aluno_id();
    IF v_aluno_id IS NULL THEN
      RAISE EXCEPTION 'Só alunos podem acessar avaliações.';
    END IF;

    SELECT * INTO v_avaliacao FROM avaliacoes WHERE id = p_avaliacao_id;
    IF NOT FOUND OR v_avaliacao.status NOT IN ('PUBLICADA', 'ENCERRADA') THEN
      RAISE EXCEPTION 'Avaliação não encontrada.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM avaliacao_turmas at JOIN alunos al ON al.turma_id = at.turma_id
      WHERE at.avaliacao_id = p_avaliacao_id AND al.id = v_aluno_id
    ) THEN
      RAISE EXCEPTION 'Esta avaliação não está disponível para a sua turma.';
    END IF;

    SELECT id INTO v_resposta_id FROM avaliacao_respostas WHERE avaliacao_id = p_avaliacao_id AND aluno_id = v_aluno_id;

    RETURN QUERY
    SELECT
      q.id,
      aq.ordem,
      aq.valor,
      q.statement,
      q.image_url,
      q.alternatives,
      st.content,
      st.image_url,
      (v_resposta_id IS NOT NULL AND EXISTS (SELECT 1 FROM avaliacao_respostas_itens ri WHERE ri.resposta_id = v_resposta_id AND ri.question_id = q.id)),
      (SELECT ri.letra_marcada FROM avaliacao_respostas_itens ri WHERE ri.resposta_id = v_resposta_id AND ri.question_id = q.id)
    FROM avaliacao_questoes aq
    JOIN questions q ON q.id = aq.question_id
    LEFT JOIN support_texts st ON st.id = q.support_text_id
    WHERE aq.avaliacao_id = p_avaliacao_id
    ORDER BY aq.ordem;
  END;
  $$;

  REVOKE ALL ON FUNCTION public.rpc_questoes_avaliacao_aluno(uuid) FROM public;
  GRANT EXECUTE ON FUNCTION public.rpc_questoes_avaliacao_aluno(uuid) TO authenticated;

  -- Submete as respostas do aluno, corrige no servidor (única fonte que enxerga
  -- correct_letter) e devolve o resultado — aí sim com gabarito, pois já foi
  -- respondido. p_respostas: [{"question_id": "...", "letra": "A"}, ...]
  CREATE OR REPLACE FUNCTION public.rpc_submeter_resposta_avaliacao(p_avaliacao_id uuid, p_respostas jsonb)
  RETURNS TABLE (
    question_id uuid,
    letra_marcada text,
    correct_letter text,
    correta boolean,
    valor_obtido numeric,
    nota_final numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    v_aluno_id uuid;
    v_avaliacao avaliacoes;
    v_resposta_id uuid;
    v_item jsonb;
    v_nota numeric := 0;
  BEGIN
    v_aluno_id := public.meu_aluno_id();
    IF v_aluno_id IS NULL THEN
      RAISE EXCEPTION 'Só alunos podem responder avaliações.';
    END IF;

    SELECT * INTO v_avaliacao FROM avaliacoes WHERE id = p_avaliacao_id;
    IF NOT FOUND OR v_avaliacao.status <> 'PUBLICADA' THEN
      RAISE EXCEPTION 'Esta avaliação não está disponível para envio.';
    END IF;
    IF v_avaliacao.prazo_entrega IS NOT NULL AND now() > v_avaliacao.prazo_entrega THEN
      RAISE EXCEPTION 'O prazo de entrega desta avaliação já encerrou.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM avaliacao_turmas at JOIN alunos al ON al.turma_id = at.turma_id
      WHERE at.avaliacao_id = p_avaliacao_id AND al.id = v_aluno_id
    ) THEN
      RAISE EXCEPTION 'Esta avaliação não está disponível para a sua turma.';
    END IF;
    IF EXISTS (SELECT 1 FROM avaliacao_respostas WHERE avaliacao_id = p_avaliacao_id AND aluno_id = v_aluno_id AND finalizado_em IS NOT NULL) THEN
      RAISE EXCEPTION 'Você já enviou esta avaliação.';
    END IF;

    INSERT INTO avaliacao_respostas (avaliacao_id, aluno_id)
    VALUES (p_avaliacao_id, v_aluno_id)
    ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET avaliacao_id = EXCLUDED.avaliacao_id
    RETURNING id INTO v_resposta_id;

    DELETE FROM avaliacao_respostas_itens WHERE resposta_id = v_resposta_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_respostas)
    LOOP
      INSERT INTO avaliacao_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido)
      SELECT
        v_resposta_id,
        (v_item ->> 'question_id')::uuid,
        v_item ->> 'letra',
        q.correct_letter = (v_item ->> 'letra'),
        CASE WHEN q.correct_letter = (v_item ->> 'letra') THEN aq.valor ELSE 0 END
      FROM avaliacao_questoes aq
      JOIN questions q ON q.id = aq.question_id
      WHERE aq.avaliacao_id = p_avaliacao_id AND aq.question_id = (v_item ->> 'question_id')::uuid;
    END LOOP;

    SELECT COALESCE(SUM(valor_obtido), 0) INTO v_nota FROM avaliacao_respostas_itens WHERE resposta_id = v_resposta_id;

    UPDATE avaliacao_respostas SET finalizado_em = now(), nota = v_nota WHERE id = v_resposta_id;

    RETURN QUERY
    SELECT ri.question_id, ri.letra_marcada, q.correct_letter, ri.correta, ri.valor_obtido, v_nota
    FROM avaliacao_respostas_itens ri
    JOIN questions q ON q.id = ri.question_id
    WHERE ri.resposta_id = v_resposta_id;
  END;
  $$;

  REVOKE ALL ON FUNCTION public.rpc_submeter_resposta_avaliacao(uuid, jsonb) FROM public;
  GRANT EXECUTE ON FUNCTION public.rpc_submeter_resposta_avaliacao(uuid, jsonb) TO authenticated;

  -- Resultados de uma avaliação, para o professor-dono (ou GESTAO/COORDENACAO) conferir
  -- as notas — não passa pela RLS de avaliacao_respostas linha a linha porque agrega o
  -- nome do aluno (join com alunos, sem policy própria de leitura ampla).
  CREATE OR REPLACE FUNCTION public.rpc_resultados_avaliacao(p_avaliacao_id uuid)
  RETURNS TABLE (
    aluno_id uuid,
    aluno_nome text,
    turma_nome text,
    nota numeric,
    finalizado_em timestamptz
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM avaliacoes a WHERE a.id = p_avaliacao_id
        AND (a.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
    ) THEN
      RAISE EXCEPTION 'Sem permissão para ver os resultados desta avaliação.';
    END IF;

    RETURN QUERY
    SELECT al.id, al.nome, t.nome, r.nota, r.finalizado_em
    FROM avaliacao_respostas r
    JOIN alunos al ON al.id = r.aluno_id
    LEFT JOIN turmas t ON t.id = al.turma_id
    WHERE r.avaliacao_id = p_avaliacao_id
    ORDER BY t.nome, al.nome;
  END;
  $$;

  REVOKE ALL ON FUNCTION public.rpc_resultados_avaliacao(uuid) FROM public;
  GRANT EXECUTE ON FUNCTION public.rpc_resultados_avaliacao(uuid) TO authenticated;
