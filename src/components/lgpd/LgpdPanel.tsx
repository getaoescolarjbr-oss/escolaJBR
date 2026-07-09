import { useEffect, useState } from 'react';
import { Search, Download, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { Pessoa } from '../../types/pessoas';
import type { SolicitacaoLgpd } from '../../types/lgpd';
import { listarPessoas } from '../../services/pessoasService';
import { listarSolicitacoes, exportarDadosPessoa, excluirDadosPessoa } from '../../services/lgpdService';

const ROTULOS_STATUS: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONCLUIDA: 'Concluída',
  NEGADA: 'Negada',
};

export function LgpdPanel() {
  const { usuarioId, hasRole } = useAuth();
  const [busca, setBusca] = useState('');
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [selecionada, setSelecionada] = useState<Pessoa | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoLgpd[]>([]);
  const [processando, setProcessando] = useState<'exportar' | 'excluir' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setPessoas(busca.trim().length >= 2 ? await listarPessoas(busca) : []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  async function selecionar(p: Pessoa) {
    setSelecionada(p);
    setError(null);
    setSolicitacoes(await listarSolicitacoes(p.id));
  }

  async function handleExportar() {
    if (!selecionada || !usuarioId) return;
    setProcessando('exportar');
    setError(null);
    try {
      const dados = await exportarDadosPessoa(selecionada.id, usuarioId);
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dados-${selecionada.nome.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSolicitacoes(await listarSolicitacoes(selecionada.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao exportar dados.');
    } finally {
      setProcessando(null);
    }
  }

  async function handleExcluir() {
    if (!selecionada || !usuarioId) return;
    if (!confirm(
      `Anonimizar os dados de identidade de "${selecionada.nome}"? Nome, CPF, telefone, e-mail, nascimento e foto serão apagados/mascarados. Matrícula, notas, frequência e login vinculados continuam existindo (sem dado pessoal identificável). Esta ação não pode ser desfeita.`
    )) return;

    setProcessando('excluir');
    setError(null);
    try {
      await excluirDadosPessoa(selecionada.id, usuarioId);
      setSelecionada(null);
      setPessoas([]);
      setBusca('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir/anonimizar dados.');
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative w-full md:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar pessoa por nome, CPF ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-ms-card border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue transition-all"
        />
        {pessoas.length > 0 && !selecionada && (
          <div className="absolute z-10 mt-1 w-full bg-ms-card border border-gray-800 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
            {pessoas.map((p) => (
              <button
                key={p.id}
                onClick={() => selecionar(p)}
                className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-blue/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue"
              >
                {p.nome} {p.cpf ? `— ${p.cpf}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400 max-w-2xl">{error}</div>
      )}

      {selecionada && (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-5 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-black text-ms-main">{selecionada.nome}</p>
              <p className="text-xs text-gray-500">{selecionada.cpf || 'CPF não informado'} · {selecionada.email || 'sem e-mail'}</p>
            </div>
            <button onClick={() => setSelecionada(null)} className="text-xs text-gray-500 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue rounded">Trocar</button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportar}
              disabled={processando !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue focus-visible:ring-offset-2"
            >
              {processando === 'exportar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar dados (JSON)
            </button>

            {hasRole('GESTAO') && (
              <button
                onClick={handleExcluir}
                disabled={processando !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                {processando === 'excluir' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                Excluir / Anonimizar
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-500">
            Excluir aqui significa anonimizar a identidade (nome, CPF, contatos, foto) — matrícula, notas, frequência e
            login vinculados são preservados, exigidos por outras normas de guarda escolar. Só GESTAO pode confirmar.
          </p>

          <div>
            <p className="text-xs font-black uppercase tracking-wider text-ms-main mb-2">Histórico de solicitações</p>
            {solicitacoes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma solicitação registrada ainda.</p>
            ) : (
              <div className="space-y-1">
                {solicitacoes.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm text-gray-400 px-3 py-2 bg-ms-dark rounded-lg border border-gray-800">
                    <span>{s.tipo === 'EXPORTAR' ? 'Exportação' : 'Exclusão'} — {new Date(s.solicitado_em).toLocaleString('pt-BR')}</span>
                    <span className={s.status === 'CONCLUIDA' ? 'text-green-500 font-bold' : 'text-yellow-500 font-bold'}>
                      {ROTULOS_STATUS[s.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
