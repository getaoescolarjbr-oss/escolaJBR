import { useState } from 'react';
import { EscalaTab } from './EscalaTab';
import { FrequenciaTab } from './FrequenciaTab';
import { AusenciasTab } from './AusenciasTab';
import { TerceirizadosTab } from './TerceirizadosTab';
import { SubstituicaoTab } from './SubstituicaoTab';

type Aba = 'frequencia' | 'escala' | 'ausencias' | 'terceirizados' | 'substituicao';

// RH operacional interno: complementar à SUGESP/SED, não concede licença nem
// formaliza substituição/atribuição (ver create_gestao_rh_schema.sql).
export function RHPanel() {
  const [aba, setAba] = useState<Aba>('frequencia');

  const abas: { id: Aba; label: string }[] = [
    { id: 'frequencia', label: 'Frequência diária' },
    { id: 'escala', label: 'Escala/Jornada' },
    { id: 'ausencias', label: 'Ausências/Atestados' },
    { id: 'substituicao', label: 'Substituição' },
    { id: 'terceirizados', label: 'Terceirizados' },
  ];

  return (
    <div className="space-y-6">
      <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-lg text-xs text-blue-300">
        Módulo operacional interno — complementar à SUGESP/SED. Não concede licença oficial nem formaliza
        substituição/atribuição de professor (isso depende do PAS/DRE + Diário Oficial).
      </div>

      <div className="flex flex-wrap gap-2">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            aria-current={aba === a.id ? 'page' : undefined}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue ${
              aba === a.id ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/30' : 'bg-ms-card text-gray-400 hover:text-gray-200 border border-gray-800'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'frequencia' && <FrequenciaTab />}
      {aba === 'escala' && <EscalaTab />}
      {aba === 'ausencias' && <AusenciasTab />}
      {aba === 'substituicao' && <SubstituicaoTab />}
      {aba === 'terceirizados' && <TerceirizadosTab />}
    </div>
  );
}
