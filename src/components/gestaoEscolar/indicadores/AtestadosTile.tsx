import { useEffect, useState } from 'react';
import { carregarEstatisticasAtestados } from './atestadosStats';
import type { EstatisticasAtestados } from './atestadosStats';

interface AtestadosTileProps {
  ativos: number; // do indicador do banco (mesmo critério: ativo = true)
  onAbrir: () => void;
  versao: number; // muda quando o pop-up é fechado: relê as estatísticas
}

// Card "Servidores com atestado ativo" com resumo estatístico embaixo do número.
export function AtestadosTile({ ativos, onAbrir, versao }: AtestadosTileProps) {
  const [stats, setStats] = useState<EstatisticasAtestados | null>(null);

  useEffect(() => {
    let ativo = true;
    carregarEstatisticasAtestados().then((s) => { if (ativo) setStats(s); }).catch(() => { /* resumo é opcional; o número principal vem do banco */ });
    return () => { ativo = false; };
  }, [versao]);

  return (
    <button onClick={onAbrir} className="text-left bg-ms-card border border-gray-800 rounded-2xl p-3 flex flex-col gap-1 hover:border-ms-blueText transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue">
      <p className="text-[11px] uppercase tracking-wider text-[#2563eb] font-bold">Servidores com atestado ativo</p>
      <p className="text-3xl font-black text-ms-main">{ativos}</p>
      {stats && stats.registros > 0 && (
        <p className="text-[11px] text-gray-500 leading-snug">
          {stats.registros} registro(s) · {stats.servidores} servidor(es) · {stats.diasTotais} dias de afastamento · média {stats.duracaoMedia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d
        </p>
      )}
    </button>
  );
}
