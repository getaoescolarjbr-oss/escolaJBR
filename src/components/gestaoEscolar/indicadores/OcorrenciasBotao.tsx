import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { OcorrenciasIndicador } from './OcorrenciasIndicador';

// Botão "Ocorrências" (portal da coordenação): o gráfico por turma com filtro de período fica dentro
// de um pop-up, em vez de ocupar espaço fixo na tela. Clicar numa turma ou no total abre a lista
// completa (visto, devolutiva, nova ocorrência), como no card da Gestão Escolar.
export function OcorrenciasBotao() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-ms-blue/10 border border-ms-blue/30 text-ms-blueText hover:bg-ms-blue/20 shadow-md"
      >
        <AlertTriangle className="w-4 h-4" /> Ocorrências
      </button>
      {aberto && (
        <ModalShell titulo="Ocorrências — por turma" onClose={() => setAberto(false)} largura="max-w-3xl">
          <div className="grid grid-cols-1">
            <OcorrenciasIndicador />
          </div>
        </ModalShell>
      )}
    </>
  );
}
