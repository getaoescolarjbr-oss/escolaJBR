import { BookOpen, Filter } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="w-24 h-24 bg-ms-blue/10 rounded-full flex items-center justify-center mb-6 border border-ms-blue/20">
        <BookOpen className="w-12 h-12 text-blue-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">
        Nenhuma turma selecionada
      </h3>
      <p className="text-gray-400 text-center max-w-sm mb-8 leading-relaxed">
        Selecione uma turma e disciplina nos filtros acima para visualizar a lista de alunos e realizar chamadas ou vistos.
      </p>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400 bg-ms-blue/20 px-6 py-3 rounded-full border border-blue-900/50 shadow-lg">
        <Filter className="w-4 h-4" />
        <span>Use os filtros para começar</span>
      </div>
    </div>
  );
}
