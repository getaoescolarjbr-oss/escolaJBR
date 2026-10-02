import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { QuestoesTab } from './QuestoesTab';
import { CategoriasTab } from './admin/CategoriasTab';
import { GerenciarTab } from './admin/GerenciarTab';
import { MinhasAvaliacoesTab } from './avaliacoes/MinhasAvaliacoesTab';

type Aba = 'minhas-avaliacoes' | 'consultar' | 'gerenciar' | 'categorias';

// Gerador de avaliações: abre em Minhas Avaliações (onde a avaliação individual é cadastrada e,
// depois de salva, recebe as questões); o banco de questões (Banco de questões/Gerenciar/
// Categorias) vive ao lado, dentro do mesmo módulo. Criar avaliação liberado para PROFESSOR/GESTAO/COORDENACAO (já dá acesso às
// questões via seleção); Consultar (banco de questões bruto) restrito a GESTAO.
// Gerenciar Questões e Categorias também abrem pra COORDENACAO_AREA: pode excluir/editar
// questões e gerenciar termos de assunto/tópico, mas não criar questão nem mexer nos outros
// campos de taxonomia — RLS libera só isso pra esse papel (ver
// permitir_coordenacao_area_excluir_questoes.sql e
// permitir_coordenacao_area_editar_assunto_topico.sql). CategoriasTab já restringe a lista de
// campos mostrados conforme o papel.
export function BancoQuestoesPanel() {
  const { hasAnyRole } = useAuth();
  const isGestao = hasAnyRole(['GESTAO']);
  const podeCriarAvaliacao = hasAnyRole(['GESTAO', 'PROFESSOR', 'COORDENACAO']);
  const podeGerenciarQuestoes = hasAnyRole(['GESTAO', 'COORDENACAO_AREA']);
  const [aba, setAba] = useState<Aba>(podeCriarAvaliacao ? 'minhas-avaliacoes' : isGestao ? 'consultar' : podeGerenciarQuestoes ? 'gerenciar' : 'minhas-avaliacoes');

  const abas: { id: Aba; label: string }[] = [
    ...(podeCriarAvaliacao ? [{ id: 'minhas-avaliacoes' as const, label: 'Minhas Avaliações' }] : []),
    ...(isGestao ? [{ id: 'consultar' as const, label: 'Banco de questões' }] : []),
    ...(podeGerenciarQuestoes ? [{ id: 'gerenciar' as const, label: 'Gerenciar Questões' }] : []),
    ...(podeGerenciarQuestoes ? [{ id: 'categorias' as const, label: 'Categorias' }] : []),
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

      {aba === 'minhas-avaliacoes' && podeCriarAvaliacao && <MinhasAvaliacoesTab />}
      {aba === 'consultar' && isGestao && <QuestoesTab />}
      {aba === 'gerenciar' && podeGerenciarQuestoes && <GerenciarTab podeCriar={isGestao} />}
      {aba === 'categorias' && podeGerenciarQuestoes && <CategoriasTab />}
    </div>
  );
}
