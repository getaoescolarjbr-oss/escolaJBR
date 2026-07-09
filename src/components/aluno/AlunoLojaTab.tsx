import { useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import type { Recompensa } from '../../types/biblioteca';
import type { ResgateDetalhado } from '../../services/bibliotecaService';
import { obterMeuSaldoPontos, listarRecompensasDisponiveis, resgatarRecompensa, listarMeusResgates } from '../../services/bibliotecaService';

interface AlunoLojaTabProps {
  alunoId: string;
  onPontosMudaram: () => void;
}

export function AlunoLojaTab({ alunoId, onPontosMudaram }: AlunoLojaTabProps) {
  const [saldo, setSaldo] = useState(0);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [meusResgates, setMeusResgates] = useState<ResgateDetalhado[]>([]);
  const [resgatandoId, setResgatandoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    try {
      const [saldoAtual, disponiveis, resgates] = await Promise.all([
        obterMeuSaldoPontos(alunoId),
        listarRecompensasDisponiveis(),
        listarMeusResgates(alunoId),
      ]);
      setSaldo(saldoAtual);
      setRecompensas(disponiveis);
      setMeusResgates(resgates);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  async function handleResgatar(recompensaId: string) {
    setResgatandoId(recompensaId);
    setMensagem(null);
    try {
      const resgate = await resgatarRecompensa(recompensaId);
      setMensagem(`Resgate feito! Mostre o código ${resgate.codigo} na biblioteca para retirar.`);
      await carregar();
      onPontosMudaram();
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível resgatar esta recompensa.');
    } finally {
      setResgatandoId(null);
    }
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>;
  }

  return (
    <div className="space-y-6">
      {mensagem && <div className="p-3 bg-ms-card border border-ms-blue/30 rounded-xl text-sm text-ms-main">{mensagem}</div>}

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1"><Gift className="w-3.5 h-3.5" /> Loja de prêmios ({saldo} pontos)</h2>
        {recompensas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum prêmio disponível no momento.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recompensas.map((r) => {
              const podeResgatar = saldo >= r.custo_pontos;
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-ms-main">{r.nome}</p>
                    <p className="text-[11px] text-gray-500">{r.custo_pontos} pontos · {r.estoque} disponível(is)</p>
                  </div>
                  <button
                    onClick={() => handleResgatar(r.id)}
                    disabled={!podeResgatar || resgatandoId === r.id}
                    className="px-3 py-2 bg-ms-blue text-white rounded-lg text-[11px] font-bold hover:bg-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resgatandoId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : podeResgatar ? 'Resgatar' : 'Pontos insuficientes'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {meusResgates.length > 0 && (
        <section className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Meus resgates</p>
          {meusResgates.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2 bg-ms-dark border border-gray-800 rounded-xl text-xs">
              <span className="text-gray-300">{r.recompensa_nome} <span className="font-mono text-gray-500">#{r.codigo}</span></span>
              <span className={r.status === 'ENTREGUE' ? 'text-green-500' : r.status === 'CANCELADO' ? 'text-gray-500' : 'text-amber-400'}>
                {r.status === 'ENTREGUE' ? 'Entregue' : r.status === 'CANCELADO' ? 'Cancelado' : 'Aguardando retirada'}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
