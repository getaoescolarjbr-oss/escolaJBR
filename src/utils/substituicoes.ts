// Substituições (alocações espelhadas): lógica pura, sem acesso ao banco.

export interface EspelhoSubstituicao {
  substituto_id: string;
  substituto_nome: string;
  titular_id: string;
  titular_nome: string;
  disciplina_id: string;
}

// Numa substituição só aparece quem faz o trabalho: o titular sai da lista e o substituto entra
// escrito "Fulano (substituindo Beltrano)". Quem INSERE questões é o substituto; a nota que ele
// receber é gravada no titular ao publicar (rpc_publicar_avaliacao_area), porque o substituto
// trabalha sobre o diário do titular.
// `manter` (chaves "professor_id|disciplina_id"): quem já tem cota/nota salva naquela avaliação
// continua aparecendo — o banco não deixa remover cota com questão já inserida ao editar.
export function aplicarSubstituicoes<T extends { professor_id: string; professor_nome: string; disciplina_id: string }>(
  lista: T[],
  espelhos: EspelhoSubstituicao[],
  manter: Set<string> = new Set()
): T[] {
  if (espelhos.length === 0) return lista;
  const porTitular = new Map(espelhos.map((e) => [`${e.titular_id}|${e.disciplina_id}`, e]));
  const jaNaLista = new Set(lista.map((i) => `${i.professor_id}|${i.disciplina_id}`));
  const incluidos = new Set<string>();
  const saida: T[] = [];
  for (const item of lista) {
    const cobertoPor = manter.has(`${item.professor_id}|${item.disciplina_id}`) ? undefined : porTitular.get(`${item.professor_id}|${item.disciplina_id}`);
    if (cobertoPor) {
      // Titular substituído: some, e entra o substituto (se ainda não estiver na lista).
      const k = `${cobertoPor.substituto_id}|${item.disciplina_id}`;
      if (!jaNaLista.has(k) && !incluidos.has(k)) {
        incluidos.add(k);
        saida.push({ ...item, professor_id: cobertoPor.substituto_id, professor_nome: `${cobertoPor.substituto_nome} (substituindo ${cobertoPor.titular_nome})` });
      }
      continue;
    }
    const sub = espelhos.find((e) => e.substituto_id === item.professor_id && e.disciplina_id === item.disciplina_id);
    saida.push(sub ? { ...item, professor_nome: `${item.professor_nome} (substituindo ${sub.titular_nome})` } : item);
  }
  return saida;
}
