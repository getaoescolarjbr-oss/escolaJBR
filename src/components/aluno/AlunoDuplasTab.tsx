import { useEffect, useState } from 'react';
import { Users, Search, Loader2, Heart, X, BookOpen } from 'lucide-react';
import type { AlunoBusca } from '../../services/bibliotecaService';
import { buscarAlunos, listarLivros } from '../../services/bibliotecaService';
import type { DuplaComParceiro, IndicacaoDupla } from '../../services/bibliotecaSocialService';
import {
  obterMinhaDupla,
  convidarParaDupla,
  aceitarConviteDupla,
  desfazerDupla,
  listarIndicacoesDupla,
  indicarLivroParaDupla,
  atualizarIndicacaoDupla,
} from '../../services/bibliotecaSocialService';

interface AlunoDuplasTabProps {
  alunoId: string;
}

// Duplas de leitura exigem aceite mútuo — quem convida NÃO consegue aceitar o próprio
// convite (garantido por trigger no banco, não só pela tela). Ver
// create_biblioteca_fase7.sql, fn_dupla_valida_aceite.
export function AlunoDuplasTab({ alunoId }: AlunoDuplasTabProps) {
  const [dupla, setDupla] = useState<DuplaComParceiro | null>(null);
  const [indicacoes, setIndicacoes] = useState<IndicacaoDupla[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<AlunoBusca[]>([]);

  const [livroBusca, setLivroBusca] = useState('');
  const [livrosEncontrados, setLivrosEncontrados] = useState<{ id: string; titulo: string }[]>([]);
  const [enviandoIndicacao, setEnviandoIndicacao] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const minhaDupla = await obterMinhaDupla(alunoId);
      setDupla(minhaDupla);
      if (minhaDupla?.status === 'ACEITA') setIndicacoes(await listarIndicacoesDupla(minhaDupla.id));
      else setIndicacoes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  async function handleBuscar(valor: string) {
    setBusca(valor);
    setResultados(valor.trim().length >= 2 ? (await buscarAlunos(valor)).filter((a) => a.id !== alunoId) : []);
  }

  async function handleConvidar(colegaId: string) {
    setErro(null);
    try {
      await convidarParaDupla(alunoId, colegaId);
      setBusca('');
      setResultados([]);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao convidar. Vocês já podem ter uma dupla ativa.');
    }
  }

  async function handleAceitar() {
    if (!dupla) return;
    setErro(null);
    try {
      await aceitarConviteDupla(dupla.id);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao aceitar convite.');
    }
  }

  async function handleDesfazer() {
    if (!dupla) return;
    await desfazerDupla(dupla.id);
    await carregar();
  }

  async function handleBuscarLivro(valor: string) {
    setLivroBusca(valor);
    setLivrosEncontrados(valor.trim().length >= 2 ? await listarLivros({ busca: valor, somenteAtivos: true }) : []);
  }

  async function handleIndicarLivro(livroId: string) {
    if (!dupla) return;
    setEnviandoIndicacao(true);
    setErro(null);
    try {
      await indicarLivroParaDupla({ dupla_id: dupla.id, de_aluno: alunoId, para_aluno: dupla.parceiro_id, livro_id: livroId });
      setLivroBusca('');
      setLivrosEncontrados([]);
      setIndicacoes(await listarIndicacoesDupla(dupla.id));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao indicar livro.');
    } finally {
      setEnviandoIndicacao(false);
    }
  }

  async function handleAtualizarIndicacao(id: string, status: 'LIDO' | 'RECUSADA') {
    await atualizarIndicacaoDupla(id, status);
    if (dupla) setIndicacoes(await listarIndicacoesDupla(dupla.id));
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  if (!dupla) {
    return (
      <div className="space-y-4 max-w-md">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Convidar uma dupla de leitura</h2>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Buscar colega pelo nome..."
            value={busca}
            onChange={(e) => handleBuscar(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
        <div className="space-y-2">
          {resultados.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <span className="text-sm text-ms-main">{a.nome} {a.turma_nome && <span className="text-[10px] text-gray-500">· {a.turma_nome}</span>}</span>
              <button onClick={() => handleConvidar(a.id)} className="px-3 py-1.5 bg-ms-blue text-white rounded-lg text-[11px] font-bold hover:bg-blue-600 transition-all">Convidar</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (dupla.status === 'PENDENTE') {
    return (
      <div className="max-w-md bg-ms-card border border-gray-800 rounded-2xl p-6 text-center space-y-4">
        <Users className="w-8 h-8 text-ms-blueText mx-auto" />
        {dupla.sou_eu_quem_convidou ? (
          <>
            <p className="text-sm text-ms-main">Convite enviado para <strong>{dupla.parceiro_nome}</strong> — aguardando aceite.</p>
            <button onClick={handleDesfazer} className="px-4 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-gray-400 hover:text-red-400 transition-colors">Cancelar convite</button>
          </>
        ) : (
          <>
            <p className="text-sm text-ms-main"><strong>{dupla.parceiro_nome}</strong> te convidou para ser dupla de leitura!</p>
            {erro && <p className="text-xs text-red-400">{erro}</p>}
            <div className="flex gap-2 justify-center">
              <button onClick={handleAceitar} className="px-4 py-2 bg-ms-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all">Aceitar</button>
              <button onClick={handleDesfazer} className="px-4 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-gray-400 hover:text-red-400 transition-colors">Recusar</button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
        <p className="text-sm text-ms-main flex items-center gap-2"><Heart className="w-4 h-4 text-pink-400" /> Dupla com <strong>{dupla.parceiro_nome}</strong></p>
        <button onClick={handleDesfazer} className="text-[11px] text-gray-400 hover:text-red-400 flex items-center gap-1"><X className="w-3 h-3" /> Desfazer</button>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Indicar um livro pro parceiro(a)</h3>
        <div className="relative">
          <input
            placeholder="Buscar livro por título..."
            value={livroBusca}
            onChange={(e) => handleBuscarLivro(e.target.value)}
            className="w-full px-4 py-2.5 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
          {livrosEncontrados.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-ms-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              {livrosEncontrados.map((l) => (
                <button key={l.id} onClick={() => handleIndicarLivro(l.id)} disabled={enviandoIndicacao} className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-card">
                  {l.titulo}
                </button>
              ))}
            </div>
          )}
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Indicações da dupla</h3>
        {indicacoes.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma indicação ainda.</p>
        ) : (
          indicacoes.map((i) => (
            <div key={i.id} className="flex items-center justify-between px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-xs">
              <span className="text-gray-300">{i.livro_titulo} <span className="text-gray-500">({i.de_aluno === alunoId ? 'você indicou' : 'indicado pra você'})</span></span>
              {i.para_aluno === alunoId && i.status === 'PENDENTE' ? (
                <div className="flex gap-1">
                  <button onClick={() => handleAtualizarIndicacao(i.id, 'LIDO')} className="text-green-500 hover:underline">Já li</button>
                  <button onClick={() => handleAtualizarIndicacao(i.id, 'RECUSADA')} className="text-gray-500 hover:underline">Recusar</button>
                </div>
              ) : (
                <span className={i.status === 'LIDO' ? 'text-green-500' : i.status === 'RECUSADA' ? 'text-gray-500' : 'text-amber-400'}>
                  {i.status === 'LIDO' ? 'Lido' : i.status === 'RECUSADA' ? 'Recusado' : 'Pendente'}
                </span>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
