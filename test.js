
const fs = require('fs');
const file = 'd:/ESCOLA/PROVAS/JBR - JOSÉ BARBOSA/2026/Gestão escolar/portal-professor-jbr/src/services/avaliacoesService.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. In obterQuestoesCompletasDaAvaliacao
content = content.replace(
  'const questoes = linhas.map((l) => l.questions).filter((q): q is Question => !!q);',
  \const questoes = linhas.map((l) => l.questions).filter((q): q is Question => !!q);
  
  const { data: areasData } = await supabase.rpc('rpc_mapear_areas_prova', { p_prova_id: id });
  if (areasData && areasData.length > 0) {
    const areaMap = new Map(areasData.map((a: any) => [a.question_id, a.area_conhecimento]));
    for (const q of questoes) {
      if (areaMap.has(q.id)) {
        q.area = areaMap.get(q.id);
      }
    }
  }\
);

// 2. In obterQuestoesAvaliacaoAluno
content = content.replace(
  'return (data ?? []) as QuestaoParaAluno[];',
  \const result = (data ?? []) as QuestaoParaAluno[];
    const { data: areasData } = await supabase.rpc('rpc_mapear_areas_prova', { p_prova_id: avaliacaoId });
    if (areasData && areasData.length > 0) {
      const areaMap = new Map(areasData.map((a: any) => [a.question_id, a.area_conhecimento]));
      for (const q of result) {
        if (areaMap.has(q.question_id)) {
          q.discipline = areaMap.get(q.question_id) || q.discipline;
        }
      }
    }
    return result;\
);

// 3. In obterQuestoesAvaliacaoPreview
content = content.replace(
  /export async function obterQuestoesAvaliacaoPreview[^]*?return \(data \?\? \[\]\) as QuestaoParaAluno\[\];/g,
  \export async function obterQuestoesAvaliacaoPreview(avaliacaoId: string): Promise<QuestaoParaAluno[]> {
    const { data, error } = await supabase.rpc('rpc_questoes_avaliacao_preview', { p_avaliacao_id: avaliacaoId });
    if (error) throw error;
    const result = (data ?? []) as QuestaoParaAluno[];
    const { data: areasData } = await supabase.rpc('rpc_mapear_areas_prova', { p_prova_id: avaliacaoId });
    if (areasData && areasData.length > 0) {
      const areaMap = new Map(areasData.map((a: any) => [a.question_id, a.area_conhecimento]));
      for (const q of result) {
        if (areaMap.has(q.question_id)) {
          q.discipline = areaMap.get(q.question_id) || q.discipline;
        }
      }
    }
    return result;\
);

fs.writeFileSync(file, content);

