-- ====================================================================================
-- CORREÇÃO ÓPTICA (OMR) DE PROVA IMPRESSA + VERSÕES EMBARALHADAS + MODOS DE NOTA
--
-- ATENÇÃO — PARCIALMENTE SUBSTITUÍDO. Se for reaplicar este arquivo, rode
-- permitir_versao_por_aluno_avaliacao.sql LOGO EM SEGUIDA. Aquele arquivo redefine
-- rpc_gerar_versoes_prova e solta dois limites que nasceram aqui:
--   * provas_qtd_versoes_check subiu de 4 para 60;
--   * prova_versoes_rotulo_check deixou de ser IN ('A','B','C','D') e virou '^[A-Z]{1,2}$'.
-- Rodar só este arquivo devolve os limites antigos e quebra a opção "uma versão por
-- aluno" — sem erro nenhum na hora, só na próxima vez que alguém sortear 5 versões.
--
-- PRÉ-REQUISITOS (nesta ordem, todos já aplicados em produção):
--   fix_provas_table_collision.sql  -> provas / prova_*
--   integrar_provas_com_notas.sql   -> prova_avaliacao_notas, provas.disciplina_id/bimestre_id
--   create_simulados_publico.sql    -> provas.tipo, provas.token_publico
--   fix_simulado_numero_chamada.sql -> firma alunos.aluno_numero como O número da
--                                      chamada. A coluna numero_chamada, criada em
--                                      create_simulados_publico.sql, nunca foi
--                                      alimentada e ficou sempre nula — não use.
--   add_prova_correcao_manual.sql   -> prova_respostas_itens.corrigido, recalcular_nota_prova_resposta
--
-- O QUE ESTE ARQUIVO ACRESCENTA
--
-- 1. VERSÕES (A/B/C/D). Uma prova pode ser impressa em até 4 versões. A versão A é
--    SEMPRE a ordem original, sem permutar nada — é a cópia de referência do professor.
--    B/C/D embaralham questões (e, se pedido, as alternativas dentro de cada questão).
--    O embaralhamento é gravado uma única vez em prova_versoes; a folha impressa e a
--    correção leem o MESMO registro, então nunca divergem.
--
-- 2. ALOCAÇÃO ALUNO -> VERSÃO, com um código curto que vira o QR Code impresso no
--    cartão-resposta. O QR carrega só esse código: quem sabe a que prova/aluno/versão
--    ele corresponde é o servidor. Fotografar o QR de outro aluno não revela gabarito
--    nenhum, e o código não é adivinhável: 10 caracteres de um alfabeto de 30, ou seja
--    ~5,9 x 10^14 combinações.
--
-- 3. CORREÇÃO A PARTIR DAS BOLHAS LIDAS. O celular manda apenas o código do QR e a
--    letra que ele enxergou em cada linha do cartão. Toda a tradução
--    (posição impressa -> alternativa original -> acertou/errou) acontece aqui dentro,
--    pela mesma razão que rpc_submeter_resposta_avaliacao existe: correct_letter nunca
--    sai do servidor antes da hora, e um cliente adulterado não consegue se dar nota.
--
-- 4. MODOS DE NOTA, válidos tanto para AVALIACAO quanto para SIMULADO:
--      SEM_NOTA  - só relatório, nada vai para o boletim.
--      DIRETA    - a nota é a soma dos valores das questões acertadas (o de sempre).
--      PONDERADA - o aluno com o melhor desempenho vira o referencial e recebe o
--                  valor_total; os demais recebem proporcionalmente a ele.
--    A nota DIRETA continua em prova_respostas.nota (calculada por
--    recalcular_nota_prova_resposta, de add_prova_correcao_manual.sql, que este arquivo
--    não altera). A ponderada mora em coluna própria — assim a nota bruta nunca se
--    perde e dá para alternar entre os modos sem recorrigir nada.
-- ====================================================================================


-- ------------------------------------------------------------------------------------
-- 1. Colunas novas em `provas`
-- ------------------------------------------------------------------------------------

-- Como as versões B/C/D são geradas. Embaralhar só faz sentido com 2+ versões: com
-- qtd_versoes = 1 existe apenas a versão A, que é a ordem original por definição.
ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS embaralhar text NOT NULL DEFAULT 'NENHUM';
DO $$ BEGIN
  ALTER TABLE public.provas ADD CONSTRAINT provas_embaralhar_check
    CHECK (embaralhar IN ('NENHUM', 'QUESTOES', 'QUESTOES_ALTERNATIVAS'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS qtd_versoes smallint NOT NULL DEFAULT 1;
DO $$ BEGIN
  ALTER TABLE public.provas ADD CONSTRAINT provas_qtd_versoes_check CHECK (qtd_versoes BETWEEN 1 AND 4);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- true  = o cartão-resposta sai numa folha separada, só ele (leitura por câmera mais
--         confiável: a folha inteira é o alvo, sem texto de questão em volta).
-- false = o cartão sai no meio das páginas da prova, como era antes.
ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS cartao_separado boolean NOT NULL DEFAULT true;

ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS modo_nota text NOT NULL DEFAULT 'DIRETA';
DO $$ BEGIN
  ALTER TABLE public.provas ADD CONSTRAINT provas_modo_nota_check
    CHECK (modo_nota IN ('SEM_NOTA', 'DIRETA', 'PONDERADA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Quem é o referencial da ponderada: o melhor da prova inteira ('PROVA') ou o melhor
-- de cada turma ('TURMA'). Muda o resultado quando a prova é aplicada em turmas de
-- desempenho diferente — por isso é escolha explícita do professor, não um default
-- escondido.
ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS ponderada_escopo text NOT NULL DEFAULT 'PROVA';
DO $$ BEGIN
  ALTER TABLE public.provas ADD CONSTRAINT provas_ponderada_escopo_check
    CHECK (ponderada_escopo IN ('PROVA', 'TURMA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Antes deste arquivo, "AVALIACAO publicada" implicava boletim e "SIMULADO" implicava
-- nunca. Agora os dois tipos podem ir ou não — é esta coluna que decide, e o default
-- reproduz exatamente o comportamento antigo para as provas que já existem.
ALTER TABLE public.provas ADD COLUMN IF NOT EXISTS lancar_no_boletim boolean;
UPDATE public.provas SET lancar_no_boletim = (tipo = 'AVALIACAO') WHERE lancar_no_boletim IS NULL;
ALTER TABLE public.provas ALTER COLUMN lancar_no_boletim SET DEFAULT true;
ALTER TABLE public.provas ALTER COLUMN lancar_no_boletim SET NOT NULL;

-- Nota do modo PONDERADA. Fica separada de prova_respostas.nota (bruta) para que
-- trocar de modo não exija recorrigir e para o relatório poder mostrar as duas.
ALTER TABLE public.prova_respostas ADD COLUMN IF NOT EXISTS nota_ponderada numeric(5,2);


-- ------------------------------------------------------------------------------------
-- 2. Versões da prova
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prova_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  rotulo text NOT NULL CHECK (rotulo IN ('A', 'B', 'C', 'D')),

  -- Ordem em que as questões saem impressas nesta versão. Inclui dissertativas e
  -- redações: elas entram na numeração da prova, apenas não têm linha no cartão.
  ordem_questoes uuid[] NOT NULL,

  -- Permutação das alternativas, por questão:
  --   { "<question_id>": ["C", "A", "D", "B"] }
  -- Leia como "a bolha A desta folha é, na verdade, a alternativa C do banco".
  -- Questão ausente do mapa = alternativas na ordem original.
  mapa_alternativas jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prova_id, rotulo)
);

CREATE INDEX IF NOT EXISTS prova_versoes_prova_id_idx ON public.prova_versoes (prova_id);


-- ------------------------------------------------------------------------------------
-- 3. Alocação aluno -> versão (uma folha impressa por aluno)
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prova_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  versao_id uuid NOT NULL REFERENCES public.prova_versoes(id) ON DELETE CASCADE,

  -- Conteúdo literal do QR Code. Curto de propósito: quanto menos caracteres, menor a
  -- matriz do QR e mais fácil a câmera resolver de longe, em papel amassado e com a
  -- luz ruim de sala de aula.
  codigo text NOT NULL UNIQUE,

  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prova_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS prova_alocacoes_prova_id_idx ON public.prova_alocacoes (prova_id);
CREATE INDEX IF NOT EXISTS prova_alocacoes_aluno_id_idx ON public.prova_alocacoes (aluno_id);


-- ------------------------------------------------------------------------------------
-- 4. Auditoria das leituras
--
-- Guardar o que a câmera enxergou (e não só a nota que saiu daí) é o que permite
-- explicar uma contestação depois: dá para reabrir a leitura e ver que a linha 7 foi
-- registrada em branco ou com marcação dupla, em vez de discutir de memória.
-- ------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prova_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  alocacao_id uuid REFERENCES public.prova_alocacoes(id) ON DELETE SET NULL,

  -- Uma entrada por linha do cartão, na ordem impressa:
  --   "A".."E" = bolha marcada, "" = em branco, "*" = mais de uma bolha marcada.
  marcacoes jsonb NOT NULL,

  origem text NOT NULL DEFAULT 'CAMERA' CHECK (origem IN ('CAMERA', 'MANUAL')),
  lido_por uuid REFERENCES auth.users(id),
  lido_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prova_leituras_prova_id_idx ON public.prova_leituras (prova_id);
CREATE INDEX IF NOT EXISTS prova_leituras_aluno_id_idx ON public.prova_leituras (aluno_id);


-- ------------------------------------------------------------------------------------
-- 5. RLS
--
-- Mesma regra da prova-mãe em todas as tabelas: dono, GESTAO ou COORDENACAO. Aluno não
-- tem policy nenhuma aqui de propósito — mapa_alternativas é, na prática, meio caminho
-- para o gabarito, e prova_alocacoes.codigo é a credencial que autoriza corrigir.
-- ------------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prova_versoes, public.prova_alocacoes, public.prova_leituras TO authenticated;
GRANT ALL ON public.prova_versoes, public.prova_alocacoes, public.prova_leituras TO service_role;

ALTER TABLE public.prova_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prova_versoes_all_dono_ou_staff" ON public.prova_versoes;
CREATE POLICY "prova_versoes_all_dono_ou_staff"
  ON public.prova_versoes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  ));

DROP POLICY IF EXISTS "prova_alocacoes_all_dono_ou_staff" ON public.prova_alocacoes;
CREATE POLICY "prova_alocacoes_all_dono_ou_staff"
  ON public.prova_alocacoes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  ));

DROP POLICY IF EXISTS "prova_leituras_all_dono_ou_staff" ON public.prova_leituras;
CREATE POLICY "prova_leituras_all_dono_ou_staff"
  ON public.prova_leituras FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.provas p WHERE p.id = prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO'))
  ));


-- ------------------------------------------------------------------------------------
-- 6. Helpers internos
-- ------------------------------------------------------------------------------------

-- Um "pode mexer nesta prova?" único, para as RPCs abaixo não repetirem o EXISTS.
CREATE OR REPLACE FUNCTION public.pode_gerir_prova(p_prova_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM provas p
    WHERE p.id = p_prova_id
      AND (p.criado_por = auth.uid() OR public.usuario_tem_papel('GESTAO') OR public.usuario_tem_papel('COORDENACAO'))
  );
$$;

REVOKE ALL ON FUNCTION public.pode_gerir_prova(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pode_gerir_prova(uuid) TO authenticated;


-- Código do QR: 10 caracteres de um alfabeto sem os pares que a gente confunde ao
-- digitar na mão quando a câmera falha (sem O/0, I/1, S/5, B/8). O QR em si não erra,
-- mas o campo "digitar código" da tela de correção é o plano B, e é lá que a escolha
-- do alfabeto paga.
CREATE OR REPLACE FUNCTION public.gerar_codigo_alocacao()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_alfabeto constant text := '23456789ACDEFGHJKLMNPQRTUVWXYZ';
  v_codigo text;
  v_i integer;
BEGIN
  LOOP
    v_codigo := '';
    FOR v_i IN 1..10 LOOP
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.prova_alocacoes WHERE codigo = v_codigo);
  END LOOP;
  RETURN v_codigo;
END;
$$;

-- Gera o código do QR: liberada ao cliente, permitiria descobrir códigos por tentativa.
REVOKE ALL ON FUNCTION public.gerar_codigo_alocacao() FROM public;
REVOKE ALL ON FUNCTION public.gerar_codigo_alocacao() FROM authenticated;
REVOKE ALL ON FUNCTION public.gerar_codigo_alocacao() FROM anon;


-- ------------------------------------------------------------------------------------
-- 7. Geração das versões e alocação dos alunos
--
-- Idempotente por decisão explícita: rodar de novo REFAZ o sorteio. Isso invalidaria
-- folhas já impressas e já respondidas, então a função se recusa a rodar se já houver
-- resposta finalizada ou leitura registrada — nesse ponto a prova está em campo e o
-- embaralhamento virou fato histórico, não configuração.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_gerar_versoes_prova(p_prova_id uuid)
RETURNS TABLE (rotulo text, alunos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_ordem_original uuid[];
  v_i integer;
  v_rotulo text;
  v_versao_id uuid;
  v_ordem uuid[];
  v_mapa jsonb;
  v_versao_ids uuid[] := '{}';
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerar versões desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;

  IF EXISTS (SELECT 1 FROM prova_respostas WHERE prova_id = p_prova_id AND finalizado_em IS NOT NULL)
     OR EXISTS (SELECT 1 FROM prova_leituras WHERE prova_id = p_prova_id)
  THEN
    RAISE EXCEPTION 'Esta prova já tem respostas corrigidas — refazer o sorteio invalidaria as folhas já aplicadas.';
  END IF;

  SELECT array_agg(question_id ORDER BY ordem, question_id)
    INTO v_ordem_original
  FROM prova_questoes WHERE prova_id = p_prova_id;

  IF v_ordem_original IS NULL OR array_length(v_ordem_original, 1) IS NULL THEN
    RAISE EXCEPTION 'A prova não tem questões.';
  END IF;

  -- Sorteio novo: fora o que existia. O CASCADE de prova_versoes leva junto as
  -- alocações antigas (e, com elas, os códigos de QR já impressos).
  DELETE FROM prova_versoes WHERE prova_id = p_prova_id;

  FOR v_i IN 1..v_prova.qtd_versoes LOOP
    v_rotulo := chr(64 + v_i);  -- 1 -> 'A', 2 -> 'B', ...

    IF v_i = 1 OR v_prova.embaralhar = 'NENHUM' THEN
      -- Versão A é a cópia de referência: nada é permutado nela.
      v_ordem := v_ordem_original;
      v_mapa := '{}'::jsonb;
    ELSE
      SELECT array_agg(qid ORDER BY random())
        INTO v_ordem
      FROM unnest(v_ordem_original) AS qid;

      IF v_prova.embaralhar = 'QUESTOES_ALTERNATIVAS' THEN
        -- Só questão objetiva com 2+ alternativas entra no mapa: permutar uma lista de
        -- uma alternativa só é ruído, e dissertativa/redação não tem alternativa nenhuma.
        SELECT COALESCE(jsonb_object_agg(q.id::text, p.letras), '{}'::jsonb)
          INTO v_mapa
        FROM questions q
        CROSS JOIN LATERAL (
          SELECT jsonb_agg(alt->>'letter' ORDER BY random()) AS letras
          FROM jsonb_array_elements(q.alternatives) AS alt
        ) p
        WHERE q.id = ANY(v_ordem_original)
          AND q.tipo = 'OBJETIVA'
          AND jsonb_array_length(q.alternatives) > 1;
      ELSE
        v_mapa := '{}'::jsonb;
      END IF;
    END IF;

    INSERT INTO prova_versoes (prova_id, rotulo, ordem_questoes, mapa_alternativas)
    VALUES (p_prova_id, v_rotulo, v_ordem, v_mapa)
    RETURNING id INTO v_versao_id;

    v_versao_ids := v_versao_ids || v_versao_id;
  END LOOP;

  -- Distribuição em rodízio pela ordem de chamada: alunos vizinhos na sala recebem
  -- versões diferentes, que é o ponto inteiro de ter mais de uma versão.
  --
  -- Quem saiu da escola não recebe folha: transferido e remanejado continuam na tabela
  -- (com o nome riscado nas listas) e gerariam prova impressa para aluno que não vai
  -- aparecer. O filtro é uma lista de EXCLUSÃO, não de inclusão, para que um status novo
  -- que apareça amanhã entre na prova por padrão em vez de sumir dela em silêncio —
  -- errar imprimindo uma folha a mais é barato; errar deixando um aluno sem prova, não.
  -- Atestado fica: o aluno segue matriculado e faz a avaliação depois.
  INSERT INTO prova_alocacoes (prova_id, aluno_id, versao_id, codigo)
  SELECT
    p_prova_id,
    a.aluno_id,
    v_versao_ids[1 + (a.pos % v_prova.qtd_versoes)],
    public.gerar_codigo_alocacao()
  FROM (
    SELECT
      al.id AS aluno_id,
      (row_number() OVER (ORDER BY t.nome NULLS LAST, al.aluno_numero NULLS LAST, al.nome) - 1)::int AS pos
    FROM prova_turmas pt
    JOIN alunos al ON al.turma_id = pt.turma_id
    LEFT JOIN turmas t ON t.id = al.turma_id
    WHERE pt.prova_id = p_prova_id
      AND lower(coalesce(al.status, 'ativo')) NOT IN ('transferido', 'remanejado')
  ) a
  ON CONFLICT (prova_id, aluno_id) DO NOTHING;

  RETURN QUERY
  SELECT pv.rotulo, count(pa.id)::integer
  FROM prova_versoes pv
  LEFT JOIN prova_alocacoes pa ON pa.versao_id = pv.id
  WHERE pv.prova_id = p_prova_id
  GROUP BY pv.rotulo
  ORDER BY pv.rotulo;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_gerar_versoes_prova(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_versoes_prova(uuid) TO authenticated;


-- ------------------------------------------------------------------------------------
-- 8. Folhas a imprimir: um registro por aluno, com tudo que a página de impressão
--    precisa (dados do aluno + a versão que ele recebeu + o código do QR).
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_alocacoes_prova(p_prova_id uuid)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  -- Vem de alunos.aluno_numero; a saída se chama numero_chamada porque é assim que o
  -- número aparece em toda a interface.
  numero_chamada integer,
  codigo_sgde text,
  turma_id uuid,
  turma_nome text,
  serie_nome text,
  rotulo text,
  codigo text,
  ordem_questoes uuid[],
  mapa_alternativas jsonb,
  ja_corrigido boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver as folhas desta prova.';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.nome,
    al.aluno_numero,
    al.codigo_sgde,
    al.turma_id,
    t.nome,
    sr.nome,
    pv.rotulo,
    pa.codigo,
    pv.ordem_questoes,
    pv.mapa_alternativas,
    EXISTS (SELECT 1 FROM prova_respostas r WHERE r.prova_id = p_prova_id AND r.aluno_id = al.id AND r.finalizado_em IS NOT NULL)
  FROM prova_alocacoes pa
  JOIN alunos al ON al.id = pa.aluno_id
  JOIN prova_versoes pv ON pv.id = pa.versao_id
  LEFT JOIN turmas t ON t.id = al.turma_id
  LEFT JOIN series_referencia sr ON sr.id = t.serie_id
  WHERE pa.prova_id = p_prova_id
  ORDER BY t.nome NULLS LAST, al.aluno_numero NULLS LAST, al.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_alocacoes_prova(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_alocacoes_prova(uuid) TO authenticated;


-- ------------------------------------------------------------------------------------
-- 9. As linhas do cartão-resposta de uma versão
--
-- Fonte única da verdade sobre "o que é a linha 7 desta folha". A impressão, o gabarito
-- e a correção óptica leem daqui — quando essa lógica estava duplicada, bastava uma das
-- cópias tratar dissertativa de um jeito diferente para a numeração sair deslocada e a
-- prova inteira ser corrigida errado, em silêncio.
--
-- Só questão OBJETIVA com alternativas ganha linha; dissertativa e redação ocupam
-- número na prova mas não no cartão.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.linhas_cartao_versao(p_versao_id uuid)
RETURNS TABLE (
  linha integer,
  numero_na_prova integer,
  question_id uuid,
  correct_letter text,
  mapa jsonb,
  qtd_alternativas integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH impressas AS (
    SELECT
      q.id,
      q.tipo,
      q.correct_letter,
      q.alternatives,
      pv.mapa_alternativas -> q.id::text AS mapa,
      ord.pos::int AS numero_na_prova
    FROM prova_versoes pv
    CROSS JOIN LATERAL unnest(pv.ordem_questoes) WITH ORDINALITY AS ord(qid, pos)
    JOIN questions q ON q.id = ord.qid
    WHERE pv.id = p_versao_id
  )
  SELECT
    (row_number() OVER (ORDER BY i.numero_na_prova))::int,
    i.numero_na_prova,
    i.id,
    i.correct_letter,
    i.mapa,
    jsonb_array_length(i.alternatives)::int
  FROM impressas i
  WHERE i.tipo = 'OBJETIVA' AND jsonb_array_length(i.alternatives) > 0
  ORDER BY i.numero_na_prova;
$$;

-- Esta função devolve correct_letter e NÃO checa permissão, porque quem a chama já
-- checou. Liberá-la ao papel authenticated entregaria o gabarito de qualquer prova a
-- qualquer aluno logado — exatamente o que create_avaliacoes_schema.sql se deu ao
-- trabalho de evitar.
--
-- Revogar de `public` não basta no Supabase: o projeto tem ALTER DEFAULT PRIVILEGES
-- concedendo EXECUTE de toda função nova do schema public a anon/authenticated. Esses
-- grants são diretos, não herdados de PUBLIC, e precisam ser revogados por nome.
--
-- As duas chamadoras (rpc_gabarito_versao e rpc_corrigir_omr) são SECURITY DEFINER e
-- executam como dono, então continuam podendo chamá-la.
REVOKE ALL ON FUNCTION public.linhas_cartao_versao(uuid) FROM public;
REVOKE ALL ON FUNCTION public.linhas_cartao_versao(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.linhas_cartao_versao(uuid) FROM anon;


-- Traduz uma bolha da folha para a alternativa original do banco.
-- Devolve NULL quando não há o que traduzir: em branco, marcação múltipla ('*'), ou
-- uma bolha além do número de alternativas daquela questão (leitura suja).
CREATE OR REPLACE FUNCTION public.bolha_para_alternativa(p_bolha text, p_mapa jsonb, p_qtd_alternativas integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_bolha IS NULL OR p_bolha NOT IN ('A','B','C','D','E') THEN NULL
    WHEN ascii(p_bolha) - 64 > p_qtd_alternativas THEN NULL
    WHEN p_mapa IS NULL THEN p_bolha
    ELSE p_mapa ->> (ascii(p_bolha) - 65)
  END;
$$;

-- Auxiliar de rpc_corrigir_omr, sem uso legítimo no cliente. Mesma revogação explícita.
REVOKE ALL ON FUNCTION public.bolha_para_alternativa(text, jsonb, integer) FROM public;
REVOKE ALL ON FUNCTION public.bolha_para_alternativa(text, jsonb, integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.bolha_para_alternativa(text, jsonb, integer) FROM anon;


-- Gabarito de uma versão: para cada linha do cartão, qual BOLHA é a correta — já
-- traduzida para a folha impressa, não a letra do banco.
CREATE OR REPLACE FUNCTION public.rpc_gabarito_versao(p_prova_id uuid, p_rotulo text)
RETURNS TABLE (
  linha integer,
  numero_na_prova integer,
  question_id uuid,
  bolha_correta text,
  qtd_alternativas integer,
  valor numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao_id uuid;
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver o gabarito desta prova.';
  END IF;

  SELECT id INTO v_versao_id FROM prova_versoes WHERE prova_id = p_prova_id AND rotulo = upper(p_rotulo);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versão % não encontrada nesta prova.', p_rotulo;
  END IF;

  RETURN QUERY
  SELECT
    l.linha,
    l.numero_na_prova,
    l.question_id,
    -- Sem mapa, a bolha correta é a própria letra do banco. Com mapa, é a posição que
    -- essa letra ocupa na folha: se mapa = ["C","A","D","B"] e a correta é "C", a
    -- bolha certa é a A.
    CASE
      WHEN l.mapa IS NULL THEN l.correct_letter
      ELSE (
        SELECT chr(64 + m.pos::int)
        FROM jsonb_array_elements_text(l.mapa) WITH ORDINALITY AS m(letra, pos)
        WHERE m.letra = l.correct_letter
        LIMIT 1
      )
    END,
    l.qtd_alternativas,
    COALESCE(pq.valor, 0)
  FROM public.linhas_cartao_versao(v_versao_id) l
  LEFT JOIN prova_questoes pq ON pq.prova_id = p_prova_id AND pq.question_id = l.question_id
  ORDER BY l.linha;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_gabarito_versao(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_gabarito_versao(uuid, text) TO authenticated;


-- ------------------------------------------------------------------------------------
-- 10. Identificação pelo QR, antes de corrigir
--
-- A tela de correção chama isto assim que lê o QR, para mostrar o rosto do aluno certo
-- na tela antes de gravar nota nenhuma. Não devolve gabarito: se devolvesse, bastaria
-- fotografar um QR para descobrir as respostas.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_identificar_folha(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT
    pa.prova_id, pa.aluno_id, pa.codigo,
    pv.rotulo,
    p.titulo, p.disciplina, p.valor_total, p.modo_nota, p.status,
    al.nome AS aluno_nome, al.aluno_numero AS numero_chamada, al.codigo_sgde,
    t.nome AS turma_nome, sr.nome AS serie_nome,
    (SELECT count(*) FROM unnest(pv.ordem_questoes) AS qid
       JOIN questions q ON q.id = qid
      WHERE q.tipo = 'OBJETIVA' AND jsonb_array_length(q.alternatives) > 0) AS linhas_cartao,
    r.finalizado_em, r.nota, r.nota_ponderada
  INTO v_rec
  FROM prova_alocacoes pa
  JOIN prova_versoes pv ON pv.id = pa.versao_id
  JOIN provas p ON p.id = pa.prova_id
  JOIN alunos al ON al.id = pa.aluno_id
  LEFT JOIN turmas t ON t.id = al.turma_id
  LEFT JOIN series_referencia sr ON sr.id = t.serie_id
  LEFT JOIN prova_respostas r ON r.prova_id = pa.prova_id AND r.aluno_id = pa.aluno_id
  WHERE pa.codigo = upper(trim(p_codigo));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código não encontrado. Confira se o cartão é desta prova.';
  END IF;

  IF NOT public.pode_gerir_prova(v_rec.prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta prova.';
  END IF;

  RETURN jsonb_build_object(
    'prova_id', v_rec.prova_id,
    'aluno_id', v_rec.aluno_id,
    'codigo', v_rec.codigo,
    'versao', v_rec.rotulo,
    'titulo', v_rec.titulo,
    'disciplina', v_rec.disciplina,
    'valor_total', v_rec.valor_total,
    'modo_nota', v_rec.modo_nota,
    'status', v_rec.status,
    'aluno_nome', v_rec.aluno_nome,
    'numero_chamada', v_rec.numero_chamada,
    'codigo_sgde', v_rec.codigo_sgde,
    'turma_nome', v_rec.turma_nome,
    'serie_nome', v_rec.serie_nome,
    'linhas_cartao', v_rec.linhas_cartao,
    'ja_corrigido', v_rec.finalizado_em IS NOT NULL,
    'nota', v_rec.nota,
    'nota_ponderada', v_rec.nota_ponderada
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_identificar_folha(text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_identificar_folha(text) TO authenticated;


-- ------------------------------------------------------------------------------------
-- 11. Correção óptica
--
-- p_marcacoes: array na ordem das linhas do cartão daquela versão —
--   ["A", "C", "", "B", "*", ...]
--   ""  = nenhuma bolha preenchida
--   "*" = duas ou mais bolhas preenchidas (anulada, vale 0, igual a errar)
--
-- O cliente manda a POSIÇÃO que enxergou na folha; quem sabe que alternativa é essa
-- (e se ela está certa) é esta função. Reprocessar o mesmo cartão sobrescreve a
-- leitura anterior, que é o comportamento útil quando a primeira foto sai ruim.
--
-- Dissertativa/redação não têm linha no cartão e não são tocadas aqui: continuam
-- pendentes para CorrigirDissertativasModal, e recalcular_nota_prova_resposta já sabe
-- somar só o que está corrigido.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_corrigir_omr(p_codigo text, p_marcacoes jsonb, p_origem text DEFAULT 'CAMERA')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova_id uuid;
  v_aluno_id uuid;
  v_alocacao_id uuid;
  v_versao prova_versoes;
  v_prova provas;
  v_resposta_id uuid;
  v_acertos integer := 0;
  v_erros integer := 0;
  v_brancos integer := 0;
  v_anuladas integer := 0;
  v_total_linhas integer;
  v_nota numeric;
BEGIN
  IF p_origem NOT IN ('CAMERA', 'MANUAL') THEN
    RAISE EXCEPTION 'Origem inválida.';
  END IF;
  IF jsonb_typeof(p_marcacoes) <> 'array' THEN
    RAISE EXCEPTION 'As marcações devem vir como lista.';
  END IF;

  SELECT pa.id, pa.prova_id, pa.aluno_id INTO v_alocacao_id, v_prova_id, v_aluno_id
  FROM prova_alocacoes pa WHERE pa.codigo = upper(trim(p_codigo));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código não encontrado. Confira se o cartão é desta prova.';
  END IF;

  IF NOT public.pode_gerir_prova(v_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para corrigir esta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = v_prova_id;
  IF v_prova.status = 'RASCUNHO' THEN
    RAISE EXCEPTION 'Publique a prova antes de corrigir os cartões.';
  END IF;

  SELECT pv.* INTO v_versao FROM prova_versoes pv
  JOIN prova_alocacoes pa ON pa.versao_id = pv.id
  WHERE pa.id = v_alocacao_id;

  SELECT count(*) INTO v_total_linhas FROM public.linhas_cartao_versao(v_versao.id);

  -- Contagem diferente = a foto não é do cartão desta versão, ou o leitor perdeu uma
  -- linha. Corrigir assim mesmo deslocaria todas as respostas a partir do ponto do
  -- erro, então é melhor recusar e pedir outra foto.
  IF jsonb_array_length(p_marcacoes) <> v_total_linhas THEN
    RAISE EXCEPTION 'A leitura trouxe % linhas, mas o cartão da versão % tem %.',
      jsonb_array_length(p_marcacoes), v_versao.rotulo, v_total_linhas;
  END IF;

  INSERT INTO prova_respostas (prova_id, aluno_id)
  VALUES (v_prova_id, v_aluno_id)
  ON CONFLICT (prova_id, aluno_id) DO UPDATE SET prova_id = EXCLUDED.prova_id
  RETURNING id INTO v_resposta_id;

  -- Reprocessamento: sai só o que veio do cartão. Item de dissertativa já corrigido
  -- pelo professor sobrevive — apagar tudo aqui jogaria fora correção manual.
  DELETE FROM prova_respostas_itens ri
  USING public.linhas_cartao_versao(v_versao.id) l
  WHERE ri.resposta_id = v_resposta_id AND ri.question_id = l.question_id;

  WITH lidas AS (
    SELECT
      l.question_id,
      l.correct_letter,
      m.bolha,
      public.bolha_para_alternativa(m.bolha, l.mapa, l.qtd_alternativas) AS letra_original
    FROM public.linhas_cartao_versao(v_versao.id) l
    JOIN LATERAL (
      SELECT upper(trim(COALESCE(x.valor, ''))) AS bolha
      FROM jsonb_array_elements_text(p_marcacoes) WITH ORDINALITY AS x(valor, pos)
      WHERE x.pos = l.linha
    ) m ON true
  )
  INSERT INTO prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido, corrigido, corrigido_por, corrigido_em)
  SELECT
    v_resposta_id,
    li.question_id,
    li.bolha,
    li.letra_original IS NOT NULL AND li.letra_original = li.correct_letter,
    CASE WHEN li.letra_original IS NOT NULL AND li.letra_original = li.correct_letter
         THEN COALESCE(pq.valor, 0) ELSE 0 END,
    true,
    auth.uid(),
    now()
  FROM lidas li
  LEFT JOIN prova_questoes pq ON pq.prova_id = v_prova_id AND pq.question_id = li.question_id;

  -- Dissertativa/redação que ainda não tem item: cria pendente, para a prova não
  -- fechar como "corrigida" ignorando a parte escrita.
  INSERT INTO prova_respostas_itens (resposta_id, question_id, letra_marcada, correta, valor_obtido, corrigido)
  SELECT v_resposta_id, q.id, NULL, false, 0, false
  FROM unnest(v_versao.ordem_questoes) AS qid
  JOIN questions q ON q.id = qid
  WHERE q.tipo IN ('DISSERTATIVA', 'REDACAO')
  ON CONFLICT (resposta_id, question_id) DO NOTHING;

  SELECT
    count(*) FILTER (WHERE ri.correta)::int,
    count(*) FILTER (WHERE NOT ri.correta AND ri.letra_marcada IN ('A','B','C','D','E'))::int,
    count(*) FILTER (WHERE ri.letra_marcada IS NULL OR ri.letra_marcada = '')::int,
    count(*) FILTER (WHERE ri.letra_marcada = '*')::int
  INTO v_acertos, v_erros, v_brancos, v_anuladas
  FROM prova_respostas_itens ri
  JOIN public.linhas_cartao_versao(v_versao.id) l ON l.question_id = ri.question_id
  WHERE ri.resposta_id = v_resposta_id;

  UPDATE prova_respostas SET finalizado_em = COALESCE(finalizado_em, now()) WHERE id = v_resposta_id;

  v_nota := public.recalcular_nota_prova_resposta(v_resposta_id);

  INSERT INTO prova_leituras (prova_id, aluno_id, alocacao_id, marcacoes, origem, lido_por)
  VALUES (v_prova_id, v_aluno_id, v_alocacao_id, p_marcacoes, p_origem, auth.uid());

  -- A ponderada é relativa à turma inteira: a nota de todo mundo muda quando entra um
  -- cartão melhor que o recordista atual. Por isso recalcula a prova toda, não só este.
  IF v_prova.modo_nota = 'PONDERADA' THEN
    PERFORM public.rpc_recalcular_ponderada(v_prova_id);
    SELECT nota_ponderada INTO v_nota FROM prova_respostas WHERE id = v_resposta_id;
  END IF;

  RETURN jsonb_build_object(
    'aluno_id', v_aluno_id,
    'prova_id', v_prova_id,
    'versao', v_versao.rotulo,
    'acertos', v_acertos,
    'erros', v_erros,
    'em_branco', v_brancos,
    'anuladas', v_anuladas,
    'total_linhas', v_total_linhas,
    'nota', v_nota,
    'valor_total', v_prova.valor_total,
    'modo_nota', v_prova.modo_nota
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_corrigir_omr(text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_corrigir_omr(text, jsonb, text) TO authenticated;


-- ------------------------------------------------------------------------------------
-- 12. Nota ponderada
--
-- Regra: o melhor desempenho da prova (ou da turma, conforme ponderada_escopo) vira o
-- referencial e recebe valor_total; os demais recebem valor_total * seu / referencial.
--
-- O "desempenho" comparado são os PONTOS obtidos, não a contagem crua de acertos.
-- Quando todas as questões valem o mesmo — o padrão do gerador, valor_total dividido
-- igualmente — os dois números são proporcionais e o resultado é exatamente "quem
-- acertou mais". Quando o professor deu pesos diferentes, usar pontos respeita esses
-- pesos; contar acertos os ignoraria, e uma questão que ele marcou como valendo o
-- dobro deixaria de valer o dobro justo no cálculo da nota.
--
-- Referencial com 0 ponto (ninguém acertou nada) deixa todo mundo com 0, em vez de
-- dividir por zero ou dar nota máxima a quem zerou.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_recalcular_ponderada(p_prova_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_afetadas integer;
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para recalcular as notas desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;

  IF v_prova.modo_nota <> 'PONDERADA' THEN
    UPDATE prova_respostas SET nota_ponderada = NULL WHERE prova_id = p_prova_id;
    RETURN 0;
  END IF;

  WITH base AS (
    SELECT
      r.id,
      r.nota AS pontos,
      CASE WHEN v_prova.ponderada_escopo = 'TURMA' THEN al.turma_id ELSE NULL END AS grupo
    FROM prova_respostas r
    JOIN alunos al ON al.id = r.aluno_id
    WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
  ),
  referencia AS (
    SELECT b.*, max(b.pontos) OVER (PARTITION BY b.grupo) AS topo FROM base b
  )
  UPDATE prova_respostas r
     SET nota_ponderada = CASE
       WHEN ref.topo IS NULL OR ref.topo <= 0 THEN 0
       ELSE round(v_prova.valor_total * ref.pontos / ref.topo, 2)
     END
  FROM referencia ref
  WHERE r.id = ref.id;

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  RETURN v_afetadas;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_recalcular_ponderada(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_recalcular_ponderada(uuid) TO authenticated;


-- ------------------------------------------------------------------------------------
-- 13. Lançamento no boletim
--
-- Copia a nota efetiva de cada aluno para notas_avaliacoes, usando os vínculos que
-- prova_avaliacao_notas já criou por turma (integrar_provas_com_notas.sql). Roda sob
-- demanda, não por gatilho: o professor confere o relatório e só então lança — uma
-- nota que aparece sozinha no boletim antes da conferência é pior que uma nota
-- atrasada.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_lancar_notas_boletim(p_prova_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prova provas;
  v_lancadas integer;
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para lançar as notas desta prova.';
  END IF;

  SELECT * INTO v_prova FROM provas WHERE id = p_prova_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prova não encontrada.';
  END IF;
  IF v_prova.modo_nota = 'SEM_NOTA' THEN
    RAISE EXCEPTION 'Esta prova está configurada como "sem nota" — ela gera relatório, mas não vai para o boletim.';
  END IF;
  IF NOT v_prova.lancar_no_boletim THEN
    RAISE EXCEPTION 'Esta prova está marcada para não lançar nota no boletim.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM prova_avaliacao_notas WHERE prova_id = p_prova_id) THEN
    RAISE EXCEPTION 'Esta prova ainda não tem avaliação de nota vinculada. Confira se disciplina e bimestre foram preenchidos ao publicar.';
  END IF;

  IF v_prova.modo_nota = 'PONDERADA' THEN
    PERFORM public.rpc_recalcular_ponderada(p_prova_id);
  END IF;

  INSERT INTO notas_avaliacoes (avaliacao_id, aluno_id, nota)
  SELECT
    pan.avaliacao_id,
    r.aluno_id,
    CASE WHEN v_prova.modo_nota = 'PONDERADA' THEN COALESCE(r.nota_ponderada, 0) ELSE COALESCE(r.nota, 0) END
  FROM prova_respostas r
  JOIN alunos al ON al.id = r.aluno_id
  JOIN prova_avaliacao_notas pan ON pan.prova_id = p_prova_id AND pan.turma_id = al.turma_id
  WHERE r.prova_id = p_prova_id AND r.finalizado_em IS NOT NULL
  ON CONFLICT (avaliacao_id, aluno_id) DO UPDATE SET nota = EXCLUDED.nota;

  GET DIAGNOSTICS v_lancadas = ROW_COUNT;
  RETURN v_lancadas;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_lancar_notas_boletim(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_lancar_notas_boletim(uuid) TO authenticated;


-- ------------------------------------------------------------------------------------
-- 14. Painel de correção: quem já entregou cartão e quem falta.
--     É a lista que o professor olha no fim da pilha para saber se esqueceu alguém.
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_progresso_correcao(p_prova_id uuid)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  numero_chamada integer,
  turma_nome text,
  versao text,
  codigo text,
  corrigido boolean,
  acertos integer,
  total_objetivas integer,
  nota numeric,
  nota_ponderada numeric,
  status_correcao text,
  lido_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_gerir_prova(p_prova_id) THEN
    RAISE EXCEPTION 'Sem permissão para ver o progresso desta prova.';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.nome,
    al.aluno_numero,
    t.nome,
    pv.rotulo,
    pa.codigo,
    r.finalizado_em IS NOT NULL,
    (SELECT count(*)::int FROM prova_respostas_itens ri
       JOIN questions q ON q.id = ri.question_id
      WHERE ri.resposta_id = r.id AND ri.correta AND q.tipo = 'OBJETIVA'),
    (SELECT count(*)::int FROM prova_questoes pq
       JOIN questions q ON q.id = pq.question_id
      WHERE pq.prova_id = p_prova_id AND q.tipo = 'OBJETIVA'),
    r.nota,
    r.nota_ponderada,
    r.status_correcao,
    (SELECT max(pl.lido_em) FROM prova_leituras pl WHERE pl.prova_id = p_prova_id AND pl.aluno_id = al.id)
  FROM prova_alocacoes pa
  JOIN alunos al ON al.id = pa.aluno_id
  JOIN prova_versoes pv ON pv.id = pa.versao_id
  LEFT JOIN turmas t ON t.id = al.turma_id
  LEFT JOIN prova_respostas r ON r.prova_id = p_prova_id AND r.aluno_id = al.id
  WHERE pa.prova_id = p_prova_id
  ORDER BY t.nome NULLS LAST, al.aluno_numero NULLS LAST, al.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_progresso_correcao(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_progresso_correcao(uuid) TO authenticated;
