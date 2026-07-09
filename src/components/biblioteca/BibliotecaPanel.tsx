import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LivrosTab } from './LivrosTab';
import { GenerosTab } from './GenerosTab';
import { ColecoesTab } from './ColecoesTab';
import { EmprestimosTab } from './EmprestimosTab';
import { ReservasTab } from './ReservasTab';
import { IndicacoesCompraTab } from './IndicacoesCompraTab';
import { ConquistasTab } from './ConquistasTab';
import { RecompensasTab } from './RecompensasTab';
import { ResgatesTab } from './ResgatesTab';
import { ModeracaoTab } from './ModeracaoTab';

type Aba = 'emprestimos' | 'reservas' | 'livros' | 'generos' | 'colecoes' | 'indicacoes' | 'conquistas' | 'recompensas' | 'resgates' | 'moderacao';

// Fase 2: acervo (livros, exemplares, gêneros, coleções). Fase 3: circulação
// (empréstimo/devolução/renovação no balcão, fila de reserva, sugestões de compra).
// Gerido por BIBLIOTECA/GESTAO. As próximas fases (home do aluno, gamificação, loja,
// social) somam abas aqui — a estrutura de tabs é a mesma já usada em
// Cozinha/Agendamento.
export function BibliotecaPanel() {
  const { hasAnyRole } = useAuth();
  // COORDENACAO só entra pra moderar (denúncia/resenha) — não mexe em acervo,
  // circulação, loja ou catálogo de conquistas, que seguem BIBLIOTECA/GESTAO.
  const somenteModeracao = hasAnyRole(['COORDENACAO']) && !hasAnyRole(['BIBLIOTECA', 'GESTAO']);
  const [aba, setAba] = useState<Aba>(somenteModeracao ? 'moderacao' : 'emprestimos');

  const abas: { id: Aba; label: string }[] = somenteModeracao
    ? [{ id: 'moderacao', label: 'Moderação' }]
    : [
        { id: 'emprestimos', label: 'Empréstimos' },
        { id: 'reservas', label: 'Reservas' },
        { id: 'livros', label: 'Livros' },
        { id: 'generos', label: 'Gêneros' },
        { id: 'colecoes', label: 'Coleções/Séries' },
        { id: 'indicacoes', label: 'Sugestões de Compra' },
        { id: 'conquistas', label: 'Conquistas' },
        { id: 'recompensas', label: 'Loja: Recompensas' },
        { id: 'resgates', label: 'Loja: Resgates' },
        { id: 'moderacao', label: 'Moderação' },
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

      {aba === 'emprestimos' && <EmprestimosTab />}
      {aba === 'reservas' && <ReservasTab />}
      {aba === 'livros' && <LivrosTab />}
      {aba === 'generos' && <GenerosTab />}
      {aba === 'colecoes' && <ColecoesTab />}
      {aba === 'indicacoes' && <IndicacoesCompraTab />}
      {aba === 'conquistas' && <ConquistasTab />}
      {aba === 'recompensas' && <RecompensasTab />}
      {aba === 'resgates' && <ResgatesTab />}
      {aba === 'moderacao' && <ModeracaoTab />}
    </div>
  );
}
