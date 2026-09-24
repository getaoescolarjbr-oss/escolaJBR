import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  largura?: string;
}

// Pilha de pop-ups abertos: com pop-up dentro de pop-up, o Esc fecha só o de cima.
const pilha: symbol[] = [];

// Casca comum dos pop-ups dos indicadores: overlay, título, fechar por Esc/clique fora.
export function ModalShell({ titulo, onClose, children, largura = 'max-w-4xl' }: ModalShellProps) {
  const id = useRef(Symbol('modal'));
  const fechar = useRef(onClose);
  useEffect(() => { fechar.current = onClose; });

  useEffect(() => {
    const meu = id.current;
    pilha.push(meu);
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pilha[pilha.length - 1] === meu) fechar.current();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      const i = pilha.indexOf(meu);
      if (i >= 0) pilha.splice(i, 1);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`bg-ms-card border border-gray-800 rounded-2xl shadow-2xl w-full ${largura} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-black uppercase tracking-wider text-ms-main">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-1 rounded-full text-gray-400 hover:text-ms-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
