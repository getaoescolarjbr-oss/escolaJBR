import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { RequisitarTab } from './RequisitarTab';
import { AprovacoesTab } from './AprovacoesTab';
import { CatalogoTab } from './CatalogoTab';
import { MovimentacoesTab } from './MovimentacoesTab';

type Aba = 'requisitar' | 'aprovacoes' | 'catalogo' | 'movimentacoes';

// Sub-módulo 4a — material de expediente/limpeza (PDDE), separado do estoque do PNAE
// (Cozinha). Requisitar é aberto a qualquer servidor; gestão do estoque e aprovação
// ficam com GESTAO/SECRETARIA.
export function AlmoxarifadoPanel() {
  const { hasAnyRole } = useAuth();
  const ehGestorDeEstoque = hasAnyRole(['GESTAO', 'SECRETARIA']);
  const [aba, setAba] = useState<Aba>('requisitar');

  const abas: { id: Aba; label: string; somenteGestor?: boolean }[] = [
    { id: 'requisitar', label: 'Requisitar' },
    { id: 'aprovacoes', label: 'Aprovações', somenteGestor: true },
    { id: 'catalogo', label: 'Catálogo', somenteGestor: true },
    { id: 'movimentacoes', label: 'Movimentações', somenteGestor: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {abas
          .filter((a) => !a.somenteGestor || ehGestorDeEstoque)
          .map((a) => (
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

      {aba === 'requisitar' && <RequisitarTab />}
      {aba === 'aprovacoes' && ehGestorDeEstoque && <AprovacoesTab />}
      {aba === 'catalogo' && ehGestorDeEstoque && <CatalogoTab />}
      {aba === 'movimentacoes' && ehGestorDeEstoque && <MovimentacoesTab />}
    </div>
  );
}
