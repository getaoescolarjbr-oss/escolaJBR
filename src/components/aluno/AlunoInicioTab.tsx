import { useEffect, useState } from 'react';
import { RotateCw, Loader2, Send, Target, CheckCircle2, X } from 'lucide-react';
import type { Meta } from '../../types/biblioteca';
import type { EmprestimoDetalhado } from '../../services/bibliotecaService';
import {
  listarMeusEmprestimos,
  renovarEmprestimo,
  listarMinhasMetas,
  criarMeta,
  concluirMeta,
  cancelarMeta,
  criarIndicacaoCompra,
} from '../../services/bibliotecaService';

interface AlunoInicioTabProps {
  alunoId: string;
  onPontosMudaram: () => void;
}

export function AlunoInicioTab({ alunoId, onPontosMudaram }: AlunoInicioTabProps) {
  const [emprestimos, setEmprestimos] = useState<EmprestimoDetalhado[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [novaMeta, setNovaMeta] = useState('');
  const [salvandoMeta, setSalvandoMeta] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tituloIndicacao, setTituloIndicacao] = useState('');
  const [autorIndicacao, setAutorIndicacao] = useState('');
  const [enviandoIndicacao, setEnviandoIndicacao] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [meusEmprestimos, minhasMetas] = await Promise.all([listarMeusEmprestimos(alunoId), listarMinhasMetas(alunoId)]);
      setEmprestimos(meusEmprestimos);
      setMetas(minhasMetas);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  async function handleRenovar(emprestimoId: string) {
    setMensagem(null);
    try {
      await renovarEmprestimo(emprestimoId);
      setEmprestimos(await listarMeusEmprestimos(alunoId));
      setMensagem('Empréstimo renovado por mais 7 dias!');
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível renovar este empréstimo.');
    }
  }

  async function handleCriarMeta() {
    if (!novaMeta.trim()) return;
    setSalvandoMeta(true);
    try {
      await criarMeta({ aluno_id: alunoId, descricao: novaMeta.trim(), livro_id: null, data_alvo: null });
      setNovaMeta('');
      setMetas(await listarMinhasMetas(alunoId));
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao criar meta.');
    } finally {
      setSalvandoMeta(false);
    }
  }

  async function handleConcluirMeta(id: string) {
    await concluirMeta(id);
    setMetas(await listarMinhasMetas(alunoId));
    setMensagem('Meta concluída! Pontos creditados.');
    onPontosMudaram();
  }

  async function handleCancelarMeta(id: string) {
    await cancelarMeta(id);
    setMetas(await listarMinhasMetas(alunoId));
  }

  async function handleIndicar() {
    if (!tituloIndicacao.trim()) return;
    setEnviandoIndicacao(true);
    try {
      await criarIndicacaoCompra({ aluno_id: alunoId, titulo: tituloIndicacao.trim(), autor: autorIndicacao.trim() || null });
      setTituloIndicacao('');
      setAutorIndicacao('');
      setMensagem('Sugestão enviada para a biblioteca!');
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao enviar sugestão.');
    } finally {
      setEnviandoIndicacao(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-8">
      {mensagem && <div className="p-3 bg-ms-card border border-ms-blueText/30 rounded-xl text-sm text-ms-main">{mensagem}</div>}

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Minhas metas</h2>
        <div className="flex gap-2">
          <input
            placeholder="Ex.: ler 3 livros de aventura este mês"
            value={novaMeta}
            onChange={(e) => setNovaMeta(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCriarMeta()}
            className="flex-1 px-4 py-2.5 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
          <button onClick={handleCriarMeta} disabled={salvandoMeta} className="px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {salvandoMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
          </button>
        </div>
        {metas.filter((m) => m.status === 'EM_ANDAMENTO').length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma meta em andamento.</p>
        ) : (
          metas.filter((m) => m.status === 'EM_ANDAMENTO').map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <p className="text-sm font-bold text-ms-main">{m.descricao}</p>
              <div className="flex gap-2">
                <button onClick={() => handleConcluirMeta(m.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px] text-green-500 hover:bg-green-500/20 transition-colors">
                  <CheckCircle2 className="w-3 h-3" /> Concluí
                </button>
                <button onClick={() => handleCancelarMeta(m.id)} className="flex items-center gap-1 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-400 hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Meus empréstimos</h2>
        {emprestimos.length === 0 ? (
          <p className="text-sm text-gray-500">Você não tem nenhum livro emprestado agora.</p>
        ) : (
          emprestimos.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">{e.livro_titulo}</p>
                <p className="text-[11px] text-gray-500">devolver até {new Date(e.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={() => handleRenovar(e.id)} className="flex items-center gap-1 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-300 hover:border-ms-blueText transition-colors">
                <RotateCw className="w-3 h-3" /> Renovar
              </button>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Indicar um livro pra biblioteca comprar</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input placeholder="Título" value={tituloIndicacao} onChange={(e) => setTituloIndicacao(e.target.value)} className="flex-1 px-4 py-2.5 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Autor (opcional)" value={autorIndicacao} onChange={(e) => setAutorIndicacao(e.target.value)} className="flex-1 px-4 py-2.5 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <button onClick={handleIndicar} disabled={enviandoIndicacao} className="flex items-center gap-2 px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {enviandoIndicacao ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </section>
    </div>
  );
}
