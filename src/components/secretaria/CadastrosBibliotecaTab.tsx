import { useEffect, useState } from 'react';
import { Loader2, Search, CheckCircle2, XCircle } from 'lucide-react';
import type { CadastroBibliotecaPendente } from '../../services/cadastroBibliotecaService';
import { listarCadastrosPendentes, aprovarCadastroBiblioteca, rejeitarCadastroBiblioteca } from '../../services/cadastroBibliotecaService';
import type { AlunoBusca } from '../../services/bibliotecaService';
import { buscarAlunos } from '../../services/bibliotecaService';

// Aprovação da Secretaria: liga a conta que o aluno criou sozinho (autocadastro do
// BiblioClube) ao registro de aluno já matriculado. Antes disto, a conta não tem
// nenhum papel — não consegue fazer nada além de ver o próprio status pendente.
export function CadastrosBibliotecaTab() {
  const [cadastros, setCadastros] = useState<CadastroBibliotecaPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [buscaPorCadastro, setBuscaPorCadastro] = useState<Record<string, string>>({});
  const [resultadosPorCadastro, setResultadosPorCadastro] = useState<Record<string, AlunoBusca[]>>({});
  const [selecionadoPorCadastro, setSelecionadoPorCadastro] = useState<Record<string, AlunoBusca | null>>({});

  async function carregar() {
    setLoading(true);
    try {
      const lista = await listarCadastrosPendentes();
      setCadastros(lista);
      // Pré-seleciona a sugestão que o próprio aluno já escolheu no formulário (ver
      // rpc_buscar_alunos_matricula) — só facilita, quem confirma de fato ao clicar em
      // "Aprovar" continua sendo a Secretaria.
      const sugestoes: Record<string, AlunoBusca | null> = {};
      lista.forEach((c) => {
        if (c.aluno_id_sugerido && c.aluno_sugerido_nome) {
          sugestoes[c.id] = { id: c.aluno_id_sugerido, nome: c.aluno_sugerido_nome, turma_nome: c.aluno_sugerido_turma_nome };
        }
      });
      setSelecionadoPorCadastro((s) => ({ ...s, ...sugestoes }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleBuscar(cadastroId: string, valor: string) {
    setBuscaPorCadastro((s) => ({ ...s, [cadastroId]: valor }));
    setSelecionadoPorCadastro((s) => ({ ...s, [cadastroId]: null }));
    setResultadosPorCadastro((s) => ({ ...s, [cadastroId]: [] }));
    if (valor.trim().length >= 2) {
      const resultados = await buscarAlunos(valor);
      setResultadosPorCadastro((s) => ({ ...s, [cadastroId]: resultados }));
    }
  }

  async function handleAprovar(cadastro: CadastroBibliotecaPendente) {
    const alunoSelecionado = selecionadoPorCadastro[cadastro.id];
    if (!alunoSelecionado) {
      setErro('Selecione o aluno correspondente antes de aprovar.');
      return;
    }
    setProcessandoId(cadastro.id);
    setErro(null);
    try {
      await aprovarCadastroBiblioteca(cadastro.id, alunoSelecionado.id);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao aprovar cadastro.');
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleRejeitar(cadastro: CadastroBibliotecaPendente) {
    const motivo = window.prompt('Motivo da rejeição (opcional):') ?? '';
    setProcessandoId(cadastro.id);
    setErro(null);
    try {
      await rejeitarCadastroBiblioteca(cadastro.id, motivo);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao rejeitar cadastro.');
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs font-black uppercase tracking-wider text-ms-main">Cadastros pendentes — BiblioClube ({cadastros.length})</p>
      {erro && <p className="text-xs text-red-400">{erro}</p>}

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
      ) : cadastros.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum cadastro aguardando aprovação.</p>
      ) : (
        cadastros.map((c) => (
          <div key={c.id} className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <div>
              <p className="text-sm font-bold text-ms-main">{c.nome_informado}</p>
              <p className="text-[11px] text-gray-500">
                {c.turma_nome ? `Turma informada: ${c.turma_nome} · ` : ''}
                {c.data_nascimento_informada ? `Nascimento: ${new Date(c.data_nascimento_informada + 'T00:00:00').toLocaleDateString('pt-BR')} · ` : ''}
                usuário: {c.username}
              </p>
              {(c.responsavel_nome || c.responsavel_contato) && (
                <p className="text-[11px] text-gray-500">Responsável: {c.responsavel_nome || '—'} {c.responsavel_contato && `(${c.responsavel_contato})`}</p>
              )}
              <p className="text-[11px] text-gray-500">Aceite de funções sociais (perfil visível para a escola): {c.aceite_funcoes_sociais ? 'sim' : 'não'}</p>
            </div>

            <div className="relative">
              {c.aluno_id_sugerido && selecionadoPorCadastro[c.id]?.id === c.aluno_id_sugerido && (
                <p className="text-[10px] text-ms-blue font-bold uppercase tracking-wider mb-1">✓ Aluno já selecionou este nome no próprio cadastro — confira antes de aprovar</p>
              )}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  placeholder="Buscar o aluno correspondente na matrícula..."
                  value={selecionadoPorCadastro[c.id]?.nome ?? buscaPorCadastro[c.id] ?? ''}
                  onChange={(e) => handleBuscar(c.id, e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                />
              </div>
              {(resultadosPorCadastro[c.id]?.length ?? 0) > 0 && !selecionadoPorCadastro[c.id] && (
                <div className="absolute z-10 mt-1 w-full bg-ms-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
                  {resultadosPorCadastro[c.id].map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelecionadoPorCadastro((s) => ({ ...s, [c.id]: a }))}
                      className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-card"
                    >
                      {a.nome} {a.turma_nome && <span className="text-[10px] text-gray-500">· {a.turma_nome}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleAprovar(c)}
                disabled={processandoId === c.id}
                className="flex items-center gap-1 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-500 hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                {processandoId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Aprovar
              </button>
              <button
                onClick={() => handleRejeitar(c)}
                disabled={processandoId === c.id}
                className="flex items-center gap-1 px-4 py-2 bg-ms-dark border border-gray-800 rounded-lg text-xs text-gray-400 hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Rejeitar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
