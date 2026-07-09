import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ConquistaGanha } from '../../services/bibliotecaService';
import { listarMinhasConquistas } from '../../services/bibliotecaService';

interface AlunoConquistasTabProps {
  alunoId: string;
}

const CORES_BADGE = [
  'bg-amber-500/10 border-amber-500/20',
  'bg-purple-500/10 border-purple-500/20',
  'bg-teal-500/10 border-teal-500/20',
  'bg-pink-500/10 border-pink-500/20',
  'bg-indigo-500/10 border-indigo-500/20',
  'bg-emerald-500/10 border-emerald-500/20',
];

export function AlunoConquistasTab({ alunoId }: AlunoConquistasTabProps) {
  const [conquistas, setConquistas] = useState<ConquistaGanha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setConquistas(await listarMinhasConquistas(alunoId));
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [alunoId]);

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>;
  }

  if (conquistas.length === 0) {
    return <p className="text-sm text-gray-500">Você ainda não ganhou nenhuma conquista — empreste um livro, cumpra uma meta ou escreva uma resenha para começar!</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {conquistas.map((c, idx) => (
        <div key={c.id} className="flex flex-col items-center gap-2 text-center bg-ms-card border border-gray-800 rounded-2xl p-4">
          <span className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-3xl shrink-0 ${CORES_BADGE[idx % CORES_BADGE.length]}`}>{c.icone || '🏅'}</span>
          <p className="text-xs font-bold text-ms-main">{c.nome}</p>
          {c.descricao && <p className="text-[10px] text-gray-500">{c.descricao}</p>}
        </div>
      ))}
    </div>
  );
}
