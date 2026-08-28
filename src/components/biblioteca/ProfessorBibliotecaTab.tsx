import { useEffect, useState } from 'react';
import { Search, BookOpen, Loader2, RefreshCw } from 'lucide-react';
import type { Livro } from '../../types/biblioteca';
import type { EmprestimoProfessor } from '../../services/bibliotecaService';
import { listarLivros, criarReservaLivroProfessor, listarMeusEmprestimosProfessor, renovarEmprestimo } from '../../services/bibliotecaService';
import { obterMeuProfessorId } from '../../services/agendamentoService';
import { useAuth } from '../../hooks/useAuth';

// Autoatendimento do professor na Biblioteca — mesma ideia da tela do aluno
// (AlunoAcervoTab), mas sem gamificação/loja/social, que são recursos do BiblioClube
// (só para alunos). O empréstimo em si continua sendo lançado pela BIBLIOTECA no
// balcão; aqui o professor só navega o acervo e reserva um título para si mesmo, e
// acompanha os empréstimos que já estão com ele.
export function ProfessorBibliotecaTab() {
  const { usuarioId } = useAuth();
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [emprestimos, setEmprestimos] = useState<EmprestimoProfessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [renovando, setRenovando] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<Livro[]>([]);
  const [buscando, setBuscando] = useState(false);

  async function carregar(pid: string) {
    setLoading(true);
    try {
      setEmprestimos(await listarMeusEmprestimosProfessor(pid));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!usuarioId) return setLoading(false);
      const pid = await obterMeuProfessorId(usuarioId);
      setProfessorId(pid);
      if (pid) await carregar(pid);
      else setLoading(false);
    }, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  async function handleBuscar() {
    if (!busca.trim()) return;
    setBuscando(true);
    try {
      setResultadosBusca(await listarLivros({ busca, somenteAtivos: true }));
    } finally {
      setBuscando(false);
    }
  }

  async function handleReservar(livroId: string) {
    if (!professorId) return;
    setMensagem(null);
    try {
      await criarReservaLivroProfessor(livroId, professorId);
      setMensagem('Reserva feita! A biblioteca vai te avisar quando o livro estiver disponível para retirada.');
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível reservar este título.');
    }
  }

  async function handleRenovar(emprestimoId: string) {
    setRenovando(emprestimoId);
    setMensagem(null);
    try {
      await renovarEmprestimo(emprestimoId);
      if (professorId) await carregar(professorId);
      setMensagem('Empréstimo renovado por mais 7 dias.');
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Não foi possível renovar este empréstimo.');
    } finally {
      setRenovando(null);
    }
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  if (!professorId) {
    return <p className="text-sm text-gray-500">Não encontramos seu vínculo de professor — fale com a Secretaria.</p>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {mensagem && <div className="p-3 bg-ms-card border border-ms-blueText/30 rounded-xl text-sm text-ms-main">{mensagem}</div>}

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Buscar no acervo</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Título ou autor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              className="w-full pl-9 pr-4 py-2.5 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            />
          </div>
          <button onClick={handleBuscar} disabled={buscando} className="px-5 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
          </button>
        </div>
        {resultadosBusca.length > 0 && (
          <div className="space-y-2">
            {resultadosBusca.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-ms-main">{l.titulo}</p>
                  <p className="text-[11px] text-gray-500">{l.autor}</p>
                </div>
                {l.tipo_acervo === 'FISICO' && (
                  <button onClick={() => handleReservar(l.id)} className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-300 hover:border-ms-blueText transition-colors">
                    Reservar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Meus empréstimos</h2>
        {emprestimos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum empréstimo ativo no momento — busque um livro acima e faça uma reserva.</p>
        ) : (
          <div className="space-y-2">
            {emprestimos.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-ms-blueText shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-ms-main">{e.livro_titulo}</p>
                    <p className="text-[11px] text-gray-500">
                      Tombo {e.tombo} · devolução até {new Date(e.data_prevista + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRenovar(e.id)}
                  disabled={renovando === e.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-300 hover:border-ms-blueText transition-colors disabled:opacity-50"
                >
                  {renovando === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Renovar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
