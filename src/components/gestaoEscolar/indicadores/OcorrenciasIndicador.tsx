import { useState } from 'react';
import { OcorrenciasTile } from './OcorrenciasTile';
import { OcorrenciasModal } from './OcorrenciasModal';
import type { PeriodoOcorrencias } from './periodoOcorrencias';

interface OcorrenciasIndicadorProps {
  // Sinal externo de que algo mudou (ex.: outro pop-up deu visto) — recarrega o gráfico já.
  versao?: number;
  onAlterado?: () => void;
}

// Card de ocorrências + pop-up, com o período (padrão: últimos 30 dias) compartilhado
// entre os dois. Usado igual em Gestão Escolar > Indicadores e na Visão Coordenação Geral.
export function OcorrenciasIndicador({ versao = 0, onAlterado }: OcorrenciasIndicadorProps) {
  const [periodo, setPeriodo] = useState<PeriodoOcorrencias>('30d');
  const [aberto, setAberto] = useState(false);
  const [versaoLocal, setVersaoLocal] = useState(0);

  return (
    <>
      <OcorrenciasTile periodo={periodo} onPeriodo={setPeriodo} versao={versao + versaoLocal} onAbrir={() => setAberto(true)} />
      {aberto && (
        <OcorrenciasModal
          filtroInicial="todas"
          periodoInicial={periodo}
          onClose={() => setAberto(false)}
          onAlterado={() => { setVersaoLocal((v) => v + 1); onAlterado?.(); }}
        />
      )}
    </>
  );
}
