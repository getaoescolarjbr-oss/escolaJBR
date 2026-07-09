import { useState } from 'react';
import { CardapioTab } from './CardapioTab';
import { EstoqueTab } from './EstoqueTab';
import { FornecedoresTab } from './FornecedoresTab';
import { IndicadoresTab } from './IndicadoresTab';
import { FichasTecnicasTab } from './FichasTecnicasTab';
import { NecessidadesEspeciaisTab } from './NecessidadesEspeciaisTab';
import { ConciliacaoTab } from './ConciliacaoTab';
import { BoasPraticasTab } from './BoasPraticasTab';

type Aba = 'cardapio' | 'fichas' | 'estoque' | 'fornecedores' | 'necessidades' | 'conciliacao' | 'boaspraticas' | 'indicadores';

export function CozinhaPanel() {
  const [aba, setAba] = useState<Aba>('cardapio');

  const abas: { id: Aba; label: string }[] = [
    { id: 'cardapio', label: 'Cardápio' },
    { id: 'fichas', label: 'Fichas Técnicas' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'fornecedores', label: 'Fornecedores' },
    { id: 'necessidades', label: 'Necessidades Especiais' },
    { id: 'conciliacao', label: 'Conciliação' },
    { id: 'boaspraticas', label: 'Boas Práticas' },
    { id: 'indicadores', label: 'Indicadores PNAE' },
  ];

  return (
    <div className="space-y-6">
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

      {aba === 'cardapio' && <CardapioTab />}
      {aba === 'fichas' && <FichasTecnicasTab />}
      {aba === 'estoque' && <EstoqueTab />}
      {aba === 'fornecedores' && <FornecedoresTab />}
      {aba === 'necessidades' && <NecessidadesEspeciaisTab />}
      {aba === 'conciliacao' && <ConciliacaoTab />}
      {aba === 'boaspraticas' && <BoasPraticasTab />}
      {aba === 'indicadores' && <IndicadoresTab />}
    </div>
  );
}
