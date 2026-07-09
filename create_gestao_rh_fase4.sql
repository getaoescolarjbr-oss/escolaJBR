-- ====================================================================================
-- GESTÃO ESCOLAR — RH operacional interno (Etapa 4, final): indicador
-- "substituições pendentes" — cobertura de hoje sem substituto atribuído ainda
-- (o dado mais acionável: alguém ausente, ninguém cobrindo). Mesmo raciocínio de
-- "tom=atencao" usado em chamados_abertos/denuncias_abertas.
-- ====================================================================================
CREATE OR REPLACE FUNCTION public.rpc_indicadores_gestao_escolar()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado JSONB;
  v_total_matriculas INTEGER;
BEGIN
  IF NOT public.usuario_tem_papel('GESTAO') THEN
    RAISE EXCEPTION 'Sem permissão para consultar indicadores de Gestão Escolar.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total_matriculas FROM matriculas;

  SELECT jsonb_build_object(

    'academico', jsonb_build_object(
      'alunos_por_status', (
        SELECT COALESCE(jsonb_object_agg(status, total), '{}'::jsonb)
        FROM (SELECT status, count(*) AS total FROM alunos GROUP BY status) s
      ),
      'ocorrencias_30_dias', jsonb_build_object(
        'total', (SELECT count(*) FROM "ocorrências" WHERE data >= current_date - 30),
        'sem_visto_coordenador', (SELECT count(*) FROM "ocorrências" WHERE data >= current_date - 30 AND visto_coordenador IS NOT TRUE)
      ),
      'servidores_atestado_ativo', (SELECT count(*) FROM atestados_servidores WHERE ativo = true),
      'infrequencia_alunos', (
        SELECT count(*) FROM (
          SELECT aluno_id, count(*) AS total, count(*) FILTER (WHERE presenca) AS presentes
          FROM chamadas
          GROUP BY aluno_id
          HAVING count(*) >= 5 AND count(*) FILTER (WHERE presenca)::numeric / count(*) < 0.75
        ) infreq
      ),
      'dias_letivos', jsonb_build_object('sem_dados', true, 'motivo', 'calendário letivo não é registrado dia a dia no banco'),
      'situacao_turmas', jsonb_build_object('sem_dados', true, 'motivo', 'não há situação final (aprovado/reprovado/abandono) registrada em matrículas ou notas')
    ),

    'secretaria', jsonb_build_object(
      'documentos_emitidos_30_dias', (SELECT count(*) FROM documentos_emitidos WHERE emitido_em >= now() - interval '30 days'),
      'protocolos_por_status', (
        SELECT COALESCE(jsonb_object_agg(status, total), '{}'::jsonb)
        FROM (SELECT status, count(*) AS total FROM protocolos GROUP BY status) s
      ),
      'divergencias_matricula', jsonb_build_object(
        'total', (SELECT count(*) FROM rpc_divergencias_matricula(NULL)),
        'matriculas_registradas', v_total_matriculas
      )
    ),

    'biblioteca', jsonb_build_object(
      'emprestimos_ativos', (SELECT count(*) FROM emprestimos WHERE status = 'ATIVO'),
      'alunos_biblioclube', (SELECT count(*) FROM usuario_papeis WHERE papel = 'ALUNO'),
      'denuncias_abertas', (SELECT count(*) FROM denuncias WHERE status = 'ABERTA'),
      'resenhas_ocultas_revisao', (SELECT count(*) FROM resenhas WHERE status = 'OCULTA'),
      'resgates_pendentes', (SELECT count(*) FROM resgates WHERE status = 'PENDENTE')
    ),

    'operacional', jsonb_build_object(
      'lotes_vencendo_7_dias', (SELECT count(*) FROM estoque_lotes WHERE validade BETWEEN current_date AND current_date + 7),
      'refeicoes_servidas_30_dias', (SELECT COALESCE(sum(quantidade_alunos), 0) FROM refeicoes_servidas WHERE criado_em >= now() - interval '30 days'),
      'reservas_pendentes', (SELECT count(*) FROM reservas WHERE status = 'PENDENTE')
    ),

    'almoxarifado', jsonb_build_object(
      'materiais_abaixo_minimo', (
        SELECT count(*) FROM materiais m
        JOIN vw_saldo_material s ON s.material_id = m.id
        WHERE m.ativo = true AND s.saldo <= m.estoque_minimo
      )
    ),

    'manutencao', jsonb_build_object(
      'chamados_abertos', (SELECT count(*) FROM chamados_manutencao WHERE status IN ('ABERTO', 'EM_ANDAMENTO')),
      'chamados_atrasados', jsonb_build_object('sem_dados', true, 'motivo', 'sem prazo/SLA definido no modelo ainda — avise o limiar desejado')
    ),

    'portaria', jsonb_build_object(
      'visitantes_presentes', (SELECT count(*) FROM visitantes WHERE saida_em IS NULL)
    ),

    'patrimonio', jsonb_build_object(
      'bens_em_manutencao', (SELECT count(*) FROM bens_patrimoniais WHERE situacao = 'EM_MANUTENCAO' AND ativo = true)
    ),

    'rh', jsonb_build_object(
      'frequencia_servidores_hoje', (
        SELECT COALESCE(jsonb_object_agg(status, total), '{}'::jsonb)
        FROM (
          SELECT status, count(*) AS total
          FROM frequencia_servidor
          WHERE data = current_date
          GROUP BY status
        ) f
      ),
      'substituicoes_pendentes', (
        SELECT count(*) FROM substituicoes WHERE data = current_date AND substituto_id IS NULL
      )
    ),

    'financeiro', jsonb_build_object('sem_dados', true, 'motivo', 'sub-módulo financeiro (PDDE/APM) ainda não existe'),

    'gerado_em', now()

  ) INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_indicadores_gestao_escolar() FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_indicadores_gestao_escolar() TO authenticated;
