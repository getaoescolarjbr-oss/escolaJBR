import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { calendarData } from '../../../data/calendarData';
import { PERIODOS_LETIVOS, contarDiasLetivos, hojeISO, listarDias } from './diasLetivos';
import type { PeriodoLetivo } from './diasLetivos';
import { Donut, BarraProgresso } from './charts';
import { ModalShell } from './ModalShell';

type Calendario = Record<string, { categoria: string; descricao?: string }>;

const formatarData = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

function DiasModal({ titulo, periodos, calendario, hoje, onClose }: { titulo: string; periodos: PeriodoLetivo[]; calendario: Calendario; hoje: string; onClose: () => void }) {
  const dias = listarDias(calendario, periodos, hoje);
  const faltam = dias.filter((d) => !d.cumprido);
  const cumpridos = dias.filter((d) => d.cumprido);
  const bloco = (titulo2: string, cor: string, lista: typeof dias) => (
    <section className="space-y-1.5">
      <h3 className={`text-xs font-black uppercase tracking-wider ${cor}`}>{titulo2} ({lista.length})</h3>
      {lista.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum dia.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-sm">
          {lista.map((d) => (
            <li key={d.data} className="flex justify-between gap-2 border-b border-gray-800 py-1">
              <span className="text-ms-main">{formatarData(d.data)}</span>
              <span className="text-gray-500 truncate text-xs self-center">{d.descricao}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <ModalShell titulo={`Dias letivos — ${titulo}`} onClose={onClose} largura="max-w-3xl">
      <div className="space-y-5">
        {bloco('Faltam cumprir', 'text-amber-400', faltam)}
        {bloco('Já cumpridos', 'text-green-500', cumpridos)}
      </div>
    </ModalShell>
  );
}

// Mesmo critério do CalendarioLetivoModal: eventos customizados sobrepõem o calendário base.
export function DiasLetivosCard() {
  const [custom, setCustom] = useState<Calendario>({});
  const [detalhe, setDetalhe] = useState<{ titulo: string; periodos: PeriodoLetivo[] } | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase
      .from('calendario_eventos')
      .select('data, categoria, descricao')
      .then(({ data }) => {
        if (!ativo || !data) return;
        const mapa: Calendario = {};
        data.forEach((e: { data: string; categoria: string; descricao?: string }) => { mapa[e.data] = { categoria: e.categoria, descricao: e.descricao }; });
        setCustom(mapa);
      });
    return () => { ativo = false; };
  }, []);

  const calendario = useMemo<Calendario>(() => ({ ...calendarData, ...custom }), [custom]);
  const hoje = hojeISO();
  const resumo = useMemo(() => contarDiasLetivos(calendario, hoje), [calendario, hoje]);
  const { geral, periodos } = resumo;
  const bimestres = PERIODOS_LETIVOS.filter((p) => p.categoria === 'letivo');

  return (
    <div className="col-span-full bg-ms-card border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-5">
      <button
        onClick={() => setDetalhe({ titulo: 'bimestres (geral)', periodos: bimestres })}
        aria-label="Dias letivos gerais: ver as datas"
        className="flex items-center gap-4 sm:w-64 flex-shrink-0 text-left rounded-xl hover:bg-gray-700/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue"
      >
        <Donut valor={geral.cumpridos} total={geral.total} />
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#2563eb] font-bold">Dias letivos (bimestres)</p>
          <p className="text-sm text-ms-main"><b>{geral.cumpridos}</b> cumpridos</p>
          <p className="text-sm text-gray-500">faltam <b>{geral.faltam}</b> de {geral.total}</p>
        </div>
      </button>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {periodos.map(({ periodo, total, cumpridos, faltam }) => (
          <button
            key={periodo.id}
            onClick={() => setDetalhe({ titulo: periodo.nome, periodos: [periodo] })}
            aria-label={`${periodo.nome}: ver as datas`}
            className="space-y-1 text-left rounded-lg p-1 -m-1 hover:bg-gray-700/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ms-main">{periodo.nome}</span>
              <span className="text-gray-500">{cumpridos}/{total} · faltam {faltam}</span>
            </div>
            <BarraProgresso valor={cumpridos} total={total} rotulo={`${periodo.nome}: ${cumpridos} de ${total} dias`} />
          </button>
        ))}
      </div>
      {detalhe && <DiasModal titulo={detalhe.titulo} periodos={detalhe.periodos} calendario={calendario} hoje={hoje} onClose={() => setDetalhe(null)} />}
    </div>
  );
}
