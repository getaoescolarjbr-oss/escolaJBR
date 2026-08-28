import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Clock, FileCheck, Loader2 } from 'lucide-react';
import type { AvaliacaoAluno } from '../../types/avaliacoes';
import { listarMinhasAvaliacoesAluno } from '../../services/avaliacoesService';
import { RealizarAvaliacaoModal } from './RealizarAvaliacaoModal';

// Avaliações online publicadas pelo professor para a turma do aluno — só aparecem aqui
// se avaliacoes.modo for ONLINE ou AMBAS; a impressa fica só no papel.
export function AlunoAvaliacoesTab() {
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [realizando, setRealizando] = useState<AvaliacaoAluno | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setAvaliacoes(await listarMinhasAvaliacoesAluno());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar suas avaliações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;

  const aFazer = avaliacoes.filter((a) => a.resposta_status === 'PENDENTE' && a.status === 'PUBLICADA');
  const enviadas = avaliacoes.filter((a) => a.resposta_status === 'ENVIADA');
  const encerradas = avaliacoes.filter((a) => a.status === 'ENCERRADA' && a.resposta_status === 'PENDENTE');

  return (
    <div className="space-y-6">
      {erro && <p className="text-sm text-red-400 font-bold">{erro}</p>}

      {avaliacoes.length === 0 ? (
        <p className="text-center text-ms-muted py-12">Nenhuma avaliação disponível no momento.</p>
      ) : (
        <>
          <Secao titulo="A fazer" icone={ClipboardList} cor="text-sky-400" itens={aFazer} onAbrir={setRealizando} />
          <Secao titulo="Enviadas" icone={FileCheck} cor="text-emerald-400" itens={enviadas} onAbrir={setRealizando} />
          <Secao titulo="Encerradas sem envio" icone={Clock} cor="text-gray-400" itens={encerradas} onAbrir={undefined} />
        </>
      )}

      {realizando && (
        <RealizarAvaliacaoModal
          avaliacao={realizando}
          onClose={() => setRealizando(null)}
          onEnviada={() => {
            setRealizando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function Secao({
  titulo,
  icone: Icone,
  cor,
  itens,
  onAbrir,
}: {
  titulo: string;
  icone: typeof ClipboardList;
  cor: string;
  itens: AvaliacaoAluno[];
  onAbrir?: (a: AvaliacaoAluno) => void;
}) {
  if (itens.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ms-main">
        <Icone className={`w-4 h-4 ${cor}`} /> {titulo}
      </h3>
      <div className="space-y-2">
        {itens.map((a) => (
          <button
            key={a.avaliacao_id}
            onClick={() => onAbrir?.(a)}
            disabled={!onAbrir}
            className="w-full text-left bg-ms-card border border-gray-800 rounded-xl px-4 py-3 hover:border-ms-blueText/50 disabled:hover:border-gray-800 disabled:opacity-70 transition-colors"
          >
            <p className="text-sm font-bold text-ms-main">{a.titulo}</p>
            <p className="text-xs text-ms-muted mt-1">
              {a.disciplina ? `${a.disciplina} · ` : ''}Valor {Number(a.valor_total).toFixed(2)}
              {a.nota !== null ? ` · Nota: ${Number(a.nota).toFixed(2)}` : ''}
            </p>
            {a.prazo_entrega && (
              <p className="text-xs text-ms-muted">Prazo: {new Date(a.prazo_entrega).toLocaleString('pt-BR')}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
