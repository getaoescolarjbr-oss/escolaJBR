import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { QuestoesTab } from './QuestoesTab';
import { CategoriasTab } from './admin/CategoriasTab';
import { GerenciarTab } from './admin/GerenciarTab';
import { NovaAvaliacaoTab } from './avaliacoes/NovaAvaliacaoTab';
import { MinhasAvaliacoesTab } from './avaliacoes/MinhasAvaliacoesTab';

type Aba = 'nova-avaliacao' | 'minhas-avaliacoes' | 'consultar' | 'gerenciar' | 'categorias';

// Gerador de avaliações: o banco de questões (Consultar/Gerenciar/Categorias) vive dentro
// deste módulo, junto com o fluxo de montar e publicar avaliações (Nova Avaliação/Minhas
// Avaliações). Criar avaliação e editar questões liberado para PROFESSOR/GESTAO/COORDENACAO;
// categorias/taxonomia e exclusão de disciplina inteira continuam restritas a GESTAO.
export function BancoQuestoesPanel() {
  const { hasAnyRole } = useAuth();
  const isGestao = hasAnyRole(['GESTAO']);
  const podeGerenciarQuestoes = hasAnyRole(['GESTAO', 'PROFESSOR']);
  const podeCriarAvaliacao = hasAnyRole(['GESTAO', 'PROFESSOR', 'COORDENACAO']);
  const [aba, setAba] = useState<Aba>(podeCriarAvaliacao ? 'nova-avaliacao' : 'consultar');

  const abas: { id: Aba; label: string }[] = [
    ...(podeCriarAvaliacao ? [{ id: 'nova-avaliacao' as const, label: 'Nova Avaliação' }] : []),
    ...(podeCriarAvaliacao ? [{ id: 'minhas-avaliacoes' as const, label: 'Minhas Avaliações' }] : []),
    { id: 'consultar', label: 'Consultar' },
    ...(podeGerenciarQuestoes ? [{ id: 'gerenciar' as const, label: 'Gerenciar Questões' }] : []),
    ...(isGestao ? [{ id: 'categorias' as const, label: 'Categorias' }] : []),
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

      {aba === 'nova-avaliacao' && podeCriarAvaliacao && <NovaAvaliacaoTab onAvaliacaoSalva={() => setAba('minhas-avaliacoes')} />}
      {aba === 'minhas-avaliacoes' && podeCriarAvaliacao && <MinhasAvaliacoesTab />}
      {aba === 'consultar' && <QuestoesTab />}
      {aba === 'gerenciar' && podeGerenciarQuestoes && <GerenciarTab />}
      {aba === 'categorias' && isGestao && <CategoriasTab />}
    </div>
  );
}
