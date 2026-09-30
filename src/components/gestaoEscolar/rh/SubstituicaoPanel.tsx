import { useState } from 'react';
import { SubstituicaoTab } from './SubstituicaoTab';
import { FolhaSubstitutoTab } from './FolhaSubstitutoTab';
import { RelatorioSubstituicoes } from './RelatorioSubstituicoes';

type Visao = 'folha' | 'aulas' | 'relatorio';

// Aba única de Substituição do RH. Reúne o que antes eram duas abas:
// - Controle da folha: planilha de lançamento do professor substituto (dia/período, turmas,
//   pagamento SED/particular, termo, lançado). É o registro principal e se alimenta sozinho
//   de atestados com substituto e dos registros por aula.
// - Relatório e gráficos: resumo, gráficos, pagamentos por substituto, atestados e
//   substituições do período, com impressão A4.
// - Registro por aula: arranjo interno de cobertura de uma aula/turma num dia (alimenta a
//   visão "minhas substituições" do professor e o controle da folha).
export function SubstituicaoPanel() {
  const [visao, setVisao] = useState<Visao>('folha');

  const visoes: { id: Visao; rotulo: string; dica: string }[] = [
    { id: 'folha', rotulo: 'Controle da folha', dica: 'Quem substituiu, quando, em quais turmas e como será pago' },
    { id: 'aulas', rotulo: 'Registro por aula', dica: 'Cobertura de uma aula ou turma em um dia' },
    { id: 'relatorio', rotulo: 'Relatório e gráficos', dica: 'Substituições, pagamentos, atestados e gráficos do período, para imprimir' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl overflow-hidden border border-gray-800 w-fit" role="tablist" aria-label="Visão da substituição">
          {visoes.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={visao === v.id}
              onClick={() => setVisao(v.id)}
              className={`px-4 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue ${
                visao === v.id ? 'bg-ms-blue text-white' : 'bg-ms-card text-gray-400 hover:text-gray-200'
              }`}
            >
              {v.rotulo}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500">{visoes.find((v) => v.id === visao)?.dica}</p>
      </div>

      {visao === 'folha' && <FolhaSubstitutoTab />}
      {visao === 'aulas' && <SubstituicaoTab />}
      {visao === 'relatorio' && <RelatorioSubstituicoes />}
    </div>
  );
}
