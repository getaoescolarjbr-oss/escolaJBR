import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { calendarData } from '../../../data/calendarData';
import { contarDiasLetivos, hojeISO } from './diasLetivos';
import { Donut, BarraProgresso } from './charts';

// Mesmo critério do CalendarioLetivoModal: eventos customizados sobrepõem o calendário base.
export function DiasLetivosCard() {
  const [custom, setCustom] = useState<Record<string, { categoria: string }>>({});

  useEffect(() => {
    let ativo = true;
    supabase
      .from('calendario_eventos')
      .select('data, categoria')
      .then(({ data }) => {
        if (!ativo || !data) return;
        const mapa: Record<string, { categoria: string }> = {};
        data.forEach((e: { data: string; categoria: string }) => { mapa[e.data] = { categoria: e.categoria }; });
        setCustom(mapa);
      });
    return () => { ativo = false; };
  }, []);

  const resumo = useMemo(() => contarDiasLetivos({ ...calendarData, ...custom }, hojeISO()), [custom]);
  const { geral, periodos } = resumo;

  return (
    <div className="col-span-full bg-ms-card border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-5">
      <div className="flex items-center gap-4 sm:w-64 flex-shrink-0">
        <Donut valor={geral.cumpridos} total={geral.total} />
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#2563eb] font-bold">Dias letivos (bimestres)</p>
          <p className="text-sm text-ms-main"><b>{geral.cumpridos}</b> cumpridos</p>
          <p className="text-sm text-gray-500">faltam <b>{geral.faltam}</b> de {geral.total}</p>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {periodos.map(({ periodo, total, cumpridos, faltam }) => (
          <div key={periodo.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ms-main">{periodo.nome}</span>
              <span className="text-gray-500">{cumpridos}/{total} · faltam {faltam}</span>
            </div>
            <BarraProgresso valor={cumpridos} total={total} rotulo={`${periodo.nome}: ${cumpridos} de ${total} dias`} />
          </div>
        ))}
      </div>
    </div>
  );
}
