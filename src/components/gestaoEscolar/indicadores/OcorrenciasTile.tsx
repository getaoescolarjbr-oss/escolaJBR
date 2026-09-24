import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { BarrasPorTurma } from './BarrasPorTurma';
import type { ItemBarra } from './BarrasPorTurma';
import { OPCOES_PERIODO, buscarOcorrenciasPeriodo, rotuloPeriodo } from './periodoOcorrencias';
import type { PeriodoOcorrencias } from './periodoOcorrencias';

const INTERVALO_MS = 15000;

interface OcorrenciasTileProps {
  periodo: PeriodoOcorrencias;
  onPeriodo: (p: PeriodoOcorrencias) => void;
  onAbrir: () => void;
  // Muda quando algo é registrado/visto no pop-up: força recarregar já, sem esperar o intervalo.
  versao: number;
}

// Card de ocorrências com filtro de período e gráfico por turma sempre visível. A tabela
// `ocorrências` não está na publicação realtime do Supabase, então o "tempo real" é
// uma releitura a cada 15 s (só turma_id do período) + na hora quando o pop-up altera algo.
export function OcorrenciasTile({ periodo, onPeriodo, onAbrir, versao }: OcorrenciasTileProps) {
  // O resultado carrega o período a que pertence: ao trocar o filtro, o gráfico antigo
  // some (resultado.periodo !== periodo) até a nova leitura chegar.
  const [resultado, setResultado] = useState<{ periodo: PeriodoOcorrencias; itens: ItemBarra[]; total: number; em: Date } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [ocorrencias, tu] = await Promise.all([
        buscarOcorrenciasPeriodo<{ turma_id: string | null }>('id, data, turma_id', periodo),
        supabase.from('turmas').select('id, nome').order('nome'),
      ]);
      if (tu.error) return;
      const contagem = new Map<string, number>();
      ocorrencias.forEach((o) => {
        if (o.turma_id) contagem.set(o.turma_id, (contagem.get(o.turma_id) ?? 0) + 1);
      });
      setResultado({
        periodo,
        itens: (tu.data ?? []).map((t: { id: string; nome: string }) => ({
          rotulo: t.nome,
          partes: [{ nome: 'Ocorrências', valor: contagem.get(t.id) ?? 0, cor: '#ef4444' }],
        })),
        total: ocorrencias.length,
        em: new Date(),
      });
    } catch {
      // mantém o último gráfico bom em vez de piscar erro a cada ciclo
    }
  }, [periodo]);

  useEffect(() => {
    const inicial = setTimeout(carregar, 0);
    const ciclo = setInterval(carregar, INTERVALO_MS);
    return () => { clearTimeout(inicial); clearInterval(ciclo); };
  }, [carregar, versao]);

  const atual = resultado?.periodo === periodo ? resultado : null;

  return (
    <div className="sm:col-span-2 bg-ms-card border border-gray-800 rounded-2xl p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onAbrir} className="text-left group" aria-label={`Abrir ocorrências: ${rotuloPeriodo(periodo)}`}>
          <p className="text-[11px] uppercase tracking-wider text-[#2563eb] font-bold">Ocorrências — por turma</p>
          <p className="text-3xl font-black text-ms-main group-hover:text-ms-blueText transition-colors">{atual?.total ?? '…'}</p>
        </button>
        <select
          aria-label="Período das ocorrências"
          value={periodo}
          onChange={(e) => onPeriodo(e.target.value as PeriodoOcorrencias)}
          className="bg-ms-dark border border-gray-700 text-ms-main text-xs font-bold rounded-lg px-2 py-1.5"
        >
          {OPCOES_PERIODO.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
        </select>
      </div>
      {atual === null ? (
        <p className="text-xs text-gray-600">Carregando…</p>
      ) : (
        <BarrasPorTurma itens={atual.itens} vazio="Nenhuma ocorrência neste período." />
      )}
      {atual && <p className="text-[10px] text-gray-600">Atualiza sozinho a cada 15 s · última leitura {atual.em.toLocaleTimeString('pt-BR')}</p>}
    </div>
  );
}
