import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { carregarDadosNotas, resumoBimestre, resumoParcialAno, resumoParcialPorTurma, MEDIA_APROVACAO } from './notasService';
import type { DadosNotas, ResumoSituacao } from './notasService';
import { BarraProgresso } from './charts';
import { PERIODOS_LETIVOS, hojeISO } from './diasLetivos';
import { EvolucaoNotasModal } from './EvolucaoNotasModal';
import { ModalShell } from './ModalShell';
import { BarrasPorTurma } from './BarrasPorTurma';

function pct(valor: number, total: number): string {
  return total > 0 ? `${((valor / total) * 100).toFixed(1).replace('.', ',')}%` : '—';
}

export function AprovacaoCard() {
  const [dados, setDados] = useState<DadosNotas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [evolucao, setEvolucao] = useState<{ bimestre?: number } | null>(null);
  const [porTurma, setPorTurma] = useState(false);

  useEffect(() => {
    let ativo = true;
    carregarDadosNotas()
      .then((d) => { if (ativo) setDados(d); })
      .catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao calcular as notas.'); });
    return () => { ativo = false; };
  }, []);

  const caixa = 'col-span-full bg-ms-card border border-gray-800 rounded-2xl p-4';

  if (erro) return <div className={caixa}><p className="text-sm text-red-400">{erro}</p></div>;
  if (!dados) {
    return (
      <div className={`${caixa} flex items-center gap-2 text-sm text-gray-500`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Calculando situação dos alunos…
      </div>
    );
  }

  // Bimestres cujo último dia já passou (os 4 primeiros períodos são os bimestres).
  const hoje = hojeISO();
  const encerrados = PERIODOS_LETIVOS.slice(0, 4).filter((p) => p.fim < hoje).length;
  const ano = resumoParcialAno(dados, encerrados);
  const bimestres: ResumoSituacao[] = [1, 2, 3, 4].map((b) => resumoBimestre(dados, b));

  return (
    <div className={`${caixa} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#2563eb] font-bold">Aprovação / reprovação — situação no ano (antes do exame)</p>
          <p className="text-[11px] text-gray-500">
            Aprovado = todas as disciplinas com média ≥ {MEDIA_APROVACAO.toFixed(1).replace('.', ',')} nos bimestres já encerrados ({encerrados} de 4; o bimestre em andamento não entra na conta). Base: {ano.total} alunos ativos.
          </p>
        </div>
        <button onClick={() => setEvolucao({})} className="px-3 py-1.5 bg-ms-dark border border-gray-700 rounded-lg text-xs font-bold text-gray-300 hover:text-ms-main hover:border-ms-blueText transition-colors">
          Ver evolução das notas
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button onClick={() => setPorTurma(true)} className="text-left rounded-xl border border-gray-800 p-3 hover:border-ms-blueText transition-colors" aria-label="Já aprovados: ver por turma">
          <p className="text-[11px] uppercase text-gray-500 font-bold">Já aprovados</p>
          <p className="text-3xl font-black text-green-500">{ano.acimaDaMedia} <span className="text-sm font-bold text-gray-500">{pct(ano.acimaDaMedia, ano.total)}</span></p>
        </button>
        <button onClick={() => setPorTurma(true)} className="text-left rounded-xl border border-gray-800 p-3 hover:border-ms-blueText transition-colors" aria-label="Faltam aprovar: ver por turma">
          <p className="text-[11px] uppercase text-gray-500 font-bold">Faltam aprovar (≥ 1 disciplina abaixo)</p>
          <p className="text-3xl font-black text-amber-400">{ano.abaixoDaMedia} <span className="text-sm font-bold text-gray-500">{pct(ano.abaixoDaMedia, ano.total)}</span></p>
        </button>
        <div className="rounded-xl border border-gray-800 p-3">
          <p className="text-[11px] uppercase text-gray-500 font-bold">Sem notas lançadas</p>
          <p className="text-3xl font-black text-ms-main">{ano.semNotas}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {bimestres.map((b, i) => {
          const comNota = b.acimaDaMedia + b.abaixoDaMedia;
          return (
            <button
              key={i}
              onClick={() => setEvolucao({ bimestre: i + 1 })}
              className="text-left rounded-xl border border-gray-800 p-3 space-y-1.5 hover:border-ms-blueText transition-colors"
              aria-label={`${i + 1}º bimestre: abrir evolução das notas`}
            >
              <p className="text-xs font-black text-ms-main">{i + 1}º Bimestre</p>
              {comNota === 0 ? (
                <p className="text-xs text-gray-600">Sem notas lançadas</p>
              ) : i + 1 > encerrados ? (
                <>
                  <p className="text-[11px] font-bold text-amber-400">Em andamento — parcial</p>
                  <p className="text-xs text-gray-400">
                    <b className="text-green-500">{b.acimaDaMedia}</b> acima da média · <b className="text-amber-400">{b.abaixoDaMedia}</b> abaixo
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400">
                    <b className="text-green-500">{b.acimaDaMedia}</b> acima da média · <b className="text-amber-400">{b.abaixoDaMedia}</b> abaixo
                  </p>
                  <BarraProgresso valor={b.acimaDaMedia} total={comNota} rotulo={`${b.acimaDaMedia} de ${comNota} alunos acima da média`} />
                </>
              )}
            </button>
          );
        })}
      </div>

      {porTurma && (
        <ModalShell titulo="Situação dos alunos por turma (antes do exame)" onClose={() => setPorTurma(false)} largura="max-w-2xl">
          <BarrasPorTurma
            itens={resumoParcialPorTurma(dados, encerrados).map(({ turma, resumo }) => ({
              rotulo: turma.nome,
              partes: [
                { nome: 'Já aprovados', valor: resumo.acimaDaMedia, cor: '#22c55e' },
                { nome: 'Faltam aprovar', valor: resumo.abaixoDaMedia, cor: '#f59e0b' },
                { nome: 'Sem notas', valor: resumo.semNotas, cor: '#6b7280' },
              ],
            }))}
          />
        </ModalShell>
      )}
      {evolucao && <EvolucaoNotasModal dados={dados} bimestreDestaque={evolucao.bimestre} onClose={() => setEvolucao(null)} />}
    </div>
  );
}
