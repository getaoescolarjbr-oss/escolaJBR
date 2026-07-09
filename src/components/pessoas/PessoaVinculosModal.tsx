import { useEffect, useState } from 'react';
import { Loader2, X, GraduationCap, Briefcase, UserRoundCheck, Plus, Trash2, Star, ShieldCheck } from 'lucide-react';
import type { Pessoa, VinculosPessoa, AlunoResponsavelVinculo } from '../../types/pessoas';
import type { Consentimento, TipoConsentimento } from '../../types/lgpd';
import {
  obterVinculos,
  tornarResponsavel,
  listarAlunosVinculados,
  buscarAlunosParaVinculo,
  vincularAluno,
  desvincularAluno,
  listarResponsaveisDoAluno,
} from '../../services/pessoasService';
import { listarConsentimentos, registrarConsentimento } from '../../services/lgpdService';

const ROTULOS_TIPO_CONSENTIMENTO: Record<TipoConsentimento, string> = {
  CADASTRO: 'Cadastro de dados',
  USO_IMAGEM: 'Uso de imagem',
  DADOS_SENSIVEIS: 'Dados sensíveis (saúde)',
};

interface PessoaVinculosModalProps {
  pessoa: Pessoa;
  onClose: () => void;
}

export function PessoaVinculosModal({ pessoa, onClose }: PessoaVinculosModalProps) {
  const [loading, setLoading] = useState(true);
  const [vinculos, setVinculos] = useState<VinculosPessoa | null>(null);
  const [parentesco, setParentesco] = useState('');
  const [criandoResponsavel, setCriandoResponsavel] = useState(false);
  const [alunosVinculados, setAlunosVinculados] = useState<AlunoResponsavelVinculo[]>([]);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<{ id: string; nome: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [responsaveisDoAluno, setResponsaveisDoAluno] = useState<{ responsavelId: string; pessoaId: string; nome: string }[]>([]);
  const [consentimentos, setConsentimentos] = useState<Consentimento[]>([]);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState('');
  const [tipoConsentimento, setTipoConsentimento] = useState<TipoConsentimento>('CADASTRO');
  const [aceite, setAceite] = useState(true);
  const [salvandoConsentimento, setSalvandoConsentimento] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const v = await obterVinculos(pessoa.id);
      setVinculos(v);
      if (v.responsavel) {
        setAlunosVinculados(await listarAlunosVinculados(v.responsavel.id));
      }
      if (v.aluno) {
        const [responsaveis, historico] = await Promise.all([
          listarResponsaveisDoAluno(v.aluno.id),
          listarConsentimentos(pessoa.id),
        ]);
        setResponsaveisDoAluno(responsaveis);
        setConsentimentos(historico);
        if (responsaveis.length > 0) setResponsavelSelecionado(responsaveis[0].pessoaId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vínculos.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistrarConsentimento() {
    if (!responsavelSelecionado) return;
    setSalvandoConsentimento(true);
    setError(null);
    try {
      await registrarConsentimento(pessoa.id, responsavelSelecionado, tipoConsentimento, aceite);
      setConsentimentos(await listarConsentimentos(pessoa.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar consentimento.');
    } finally {
      setSalvandoConsentimento(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa.id]);

  async function handleCriarResponsavel() {
    setCriandoResponsavel(true);
    setError(null);
    try {
      await tornarResponsavel(pessoa.id, parentesco);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar responsável.');
    } finally {
      setCriandoResponsavel(false);
    }
  }

  async function handleBuscarAluno(termo: string) {
    setBuscaAluno(termo);
    if (termo.trim().length < 2) {
      setResultadosBusca([]);
      return;
    }
    setResultadosBusca(await buscarAlunosParaVinculo(termo));
  }

  async function handleVincular(alunoId: string) {
    if (!vinculos?.responsavel) return;
    try {
      await vincularAluno(alunoId, vinculos.responsavel.id, alunosVinculados.length === 0);
      setBuscaAluno('');
      setResultadosBusca([]);
      setAlunosVinculados(await listarAlunosVinculados(vinculos.responsavel.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao vincular aluno.');
    }
  }

  async function handleDesvincular(vinculoId: string) {
    if (!vinculos?.responsavel) return;
    if (!confirm('Remover este vínculo?')) return;
    await desvincularAluno(vinculoId);
    setAlunosVinculados(await listarAlunosVinculados(vinculos.responsavel.id));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-ms-card w-full max-w-xl rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in duration-300 max-h-[85vh] flex flex-col">
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-ms-blue/10 to-transparent shrink-0">
          <div>
            <h3 className="text-xl font-black text-ms-main">{pessoa.nome}</h3>
            <p className="text-xs text-gray-500">Vínculos e funções desta pessoa</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" />
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{error}</div>
              )}

              {/* Aluno */}
              <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-800 bg-ms-dark/30">
                <GraduationCap className="w-5 h-5 text-ms-blue mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-ms-main">Aluno</p>
                  {vinculos?.aluno ? (
                    <p className="text-sm text-gray-400 mt-1">
                      Matriculado{vinculos.aluno.status ? ` — ${vinculos.aluno.status}` : ''}
                      {vinculos.aluno.aluno_numero ? ` (nº ${vinculos.aluno.aluno_numero})` : ''}. Edite matrícula/turma em
                      Painel Admin &gt; Alunos.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Não é aluno. Matrícula é feita em Painel Admin &gt; Alunos.</p>
                  )}
                </div>
              </div>

              {/* Consentimento LGPD (só faz sentido para quem é Aluno) */}
              {vinculos?.aluno && (
                <div className="p-4 rounded-xl border border-gray-800 bg-ms-dark/30">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-ms-blue mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-black uppercase tracking-wider text-ms-main">Consentimento LGPD</p>

                      {consentimentos.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {consentimentos.map((c) => (
                            <p key={c.id} className="text-xs text-gray-400">
                              {ROTULOS_TIPO_CONSENTIMENTO[c.tipo]}: {c.aceito ? 'aceito' : 'recusado/revogado'} em{' '}
                              {new Date(c.criado_em).toLocaleString('pt-BR')}
                            </p>
                          ))}
                        </div>
                      )}

                      {responsaveisDoAluno.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-2">
                          Vincule um responsável a este aluno para poder registrar o consentimento.
                        </p>
                      ) : (
                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <select
                            value={responsavelSelecionado}
                            onChange={(e) => setResponsavelSelecionado(e.target.value)}
                            className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                          >
                            {responsaveisDoAluno.map((r) => (
                              <option key={r.pessoaId} value={r.pessoaId}>{r.nome}</option>
                            ))}
                          </select>
                          <select
                            value={tipoConsentimento}
                            onChange={(e) => setTipoConsentimento(e.target.value as TipoConsentimento)}
                            className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                          >
                            {Object.entries(ROTULOS_TIPO_CONSENTIMENTO).map(([valor, rotulo]) => (
                              <option key={valor} value={valor}>{rotulo}</option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-sm text-ms-main px-2">
                            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
                            Aceita
                          </label>
                          <button
                            onClick={handleRegistrarConsentimento}
                            disabled={salvandoConsentimento}
                            className="px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2 justify-center"
                          >
                            {salvandoConsentimento ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Registrar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Servidor */}
              <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-800 bg-ms-dark/30">
                <Briefcase className="w-5 h-5 text-ms-blue mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-ms-main">Servidor</p>
                  {vinculos?.servidor ? (
                    <p className="text-sm text-gray-400 mt-1">Cargo: {vinculos.servidor.cargo}. Edite em Painel Admin &gt; Servidores.</p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Não é servidor.</p>
                  )}
                </div>
              </div>

              {/* Responsável */}
              <div className="p-4 rounded-xl border border-gray-800 bg-ms-dark/30">
                <div className="flex items-start gap-3">
                  <UserRoundCheck className="w-5 h-5 text-ms-blue mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-wider text-ms-main">Responsável</p>

                    {!vinculos?.responsavel ? (
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={parentesco}
                          onChange={(e) => setParentesco(e.target.value)}
                          placeholder="Parentesco (ex.: Mãe, Pai, Tutor legal)"
                          className="flex-1 px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                        />
                        <button
                          onClick={handleCriarResponsavel}
                          disabled={criandoResponsavel}
                          className="px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2 justify-center"
                        >
                          {criandoResponsavel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Tornar Responsável
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-400 mt-1">
                          Parentesco: {vinculos.responsavel.parentesco || 'não informado'}
                        </p>

                        <div className="mt-3 space-y-2">
                          {alunosVinculados.map((v) => (
                            <div key={v.id} className="flex items-center justify-between px-3 py-2 bg-ms-dark rounded-lg border border-gray-800">
                              <span className="text-sm text-ms-main flex items-center gap-2">
                                {v.principal && <Star className="w-3.5 h-3.5 text-ms-gold fill-ms-gold" />}
                                {v.aluno_nome}
                              </span>
                              <button
                                onClick={() => handleDesvincular(v.id)}
                                className="p-1.5 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                                title="Remover vínculo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          {alunosVinculados.length === 0 && (
                            <p className="text-xs text-gray-500">Nenhum aluno vinculado ainda.</p>
                          )}
                        </div>

                        <div className="mt-3 relative">
                          <input
                            type="text"
                            value={buscaAluno}
                            onChange={(e) => handleBuscarAluno(e.target.value)}
                            placeholder="Buscar aluno por nome para vincular..."
                            className="w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
                          />
                          {resultadosBusca.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-ms-card border border-gray-800 rounded-lg shadow-xl overflow-hidden">
                              {resultadosBusca.map((a) => (
                                <button
                                  key={a.id}
                                  onClick={() => handleVincular(a.id)}
                                  className="w-full text-left px-3 py-2 text-sm text-ms-main hover:bg-ms-blue/20 transition-colors"
                                >
                                  {a.nome}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
