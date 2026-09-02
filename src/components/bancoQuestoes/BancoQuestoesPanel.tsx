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
// Avaliações). Criar avaliação liberado para PROFESSOR/GESTAO/COORDENACAO (já dá acesso às
// questões via seleção); Consultar/Categorias (banco de questões bruto) restritos a GESTAO.
// Gerenciar Questões também abre pra COORDENACAO_AREA, mas só pra excluir duplicata — não cria
// questão (RLS só libera DELETE pra esse papel, ver permitir_coordenacao_area_excluir_questoes.sql).
export function BancoQuestoesPanel() {
  const { hasAnyRole } = useAuth();
  const isGestao = hasAnyRole(['GESTAO']);
  const podeCriarAvaliacao = hasAnyRole(['GESTAO', 'PROFESSOR', 'COORDENACAO']);
  const podeGerenciarQuestoes = hasAnyRole(['GESTAO', 'COORDENACAO_AREA']);
  const [aba, setAba] = useState<Aba>(podeCriarAvaliacao ? 'nova-avaliacao' : isGestao ? 'consultar' : podeGerenciarQuestoes ? 'gerenciar' : 'nova-avaliacao');

  const abas: { id: Aba; label: string }[] = [
    ...(podeCriarAvaliacao ? [{ id: 'nova-avaliacao' as const, label: 'Nova Avaliação' }] : []),
    ...(podeCriarAvaliacao ? [{ id: 'minhas-avaliacoes' as const, label: 'Minhas Avaliações' }] : []),
    ...(isGestao ? [{ id: 'consultar' as const, label: 'Consultar' }] : []),
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
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue border ${
              aba === a.id
                ? 'bg-ms-blue text-white border-ms-blue shadow-md'
                : 'bg-white dark:bg-ms-card text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-800'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'nova-avaliacao' && podeCriarAvaliacao && <NovaAvaliacaoTab onAvaliacaoSalva={() => setAba('minhas-avaliacoes')} />}
      {aba === 'minhas-avaliacoes' && podeCriarAvaliacao && <MinhasAvaliacoesTab />}
      {aba === 'consultar' && isGestao && <QuestoesTab />}
      {aba === 'gerenciar' && podeGerenciarQuestoes && <GerenciarTab podeCriar={isGestao} />}
      {aba === 'categorias' && isGestao && <CategoriasTab />}
    </div>
  );
}
