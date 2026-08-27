import { useEffect, useState } from 'react';
import { BookOpen, Loader2, Search, X } from 'lucide-react';
import { signInWithPassword } from '../services/authService';
import { solicitarCadastroBiblioteca, resolverEmailPorUsername, buscarAlunosMatricula } from '../services/cadastroBibliotecaService';
import type { AlunoMatricula } from '../services/cadastroBibliotecaService';
import { listarTurmas, listarTurmasPorSerie } from '../services/agendamentoService';
import { listarSeries } from '../services/secretariaService';
import type { SerieReferencia } from '../types/secretaria';

interface AlunoAuthProps {
  onLogin: () => void;
  onVoltar: () => void;
  onBack?: () => void;
}

type ViewState = 'LOGIN' | 'CADASTRO';

const campoClasse = 'w-full px-4 py-3 bg-[#F0F2F5] border border-[#003366]/30 text-[#003366] rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-[#003366] outline-none transition-all placeholder:text-gray-400 font-medium';
const rotuloClasse = 'block text-xs font-bold text-[#003366] uppercase tracking-widest mb-2';

export function AlunoAuth({ onLogin, onVoltar, onBack }: AlunoAuthProps) {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');

  const [series, setSeries] = useState<SerieReferencia[]>([]);
  const [serieId, setSerieId] = useState('');
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [buscaNome, setBuscaNome] = useState('');
  const [resultadosNome, setResultadosNome] = useState<AlunoMatricula[]>([]);
  const [buscandoNome, setBuscandoNome] = useState(false);
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoMatricula | null>(null);
  const [dataNascimento, setDataNascimento] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [emailPessoal, setEmailPessoal] = useState('');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelContato, setResponsavelContato] = useState('');
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceiteFuncoesSociais, setAceiteFuncoesSociais] = useState(false);
  const [mostrarTermos, setMostrarTermos] = useState(false);

  useEffect(() => {
    if (view === 'CADASTRO' && series.length === 0) {
      listarSeries().then(setSeries).catch(() => {});
    }
  }, [view, series.length]);

  // Sem série escolhida, mostra todas as turmas (evita travar quem já sabe a turma mas
  // não quer procurar a série antes) — ao escolher a série, filtra a lista.
  useEffect(() => {
    if (view !== 'CADASTRO') return;
    if (!serieId) {
      listarTurmas().then(setTurmas).catch(() => {});
      return;
    }
    listarTurmasPorSerie(serieId).then(setTurmas).catch(() => {});
  }, [view, serieId]);

  async function handleBuscarNome(valor: string) {
    setBuscaNome(valor);
    setAlunoSelecionado(null);
    if (valor.trim().length < 3) {
      setResultadosNome([]);
      return;
    }
    setBuscandoNome(true);
    try {
      setResultadosNome(await buscarAlunosMatricula(valor));
    } finally {
      setBuscandoNome(false);
    }
  }

  function handleSelecionarAluno(a: AlunoMatricula) {
    setAlunoSelecionado(a);
    setResultadosNome([]);
    if (a.turma_id) setTurmaId(a.turma_id);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const email = await resolverEmailPorUsername(username);
      const { error } = await signInWithPassword(email, senha);
      if (error) throw new Error('Usuário ou senha inválidos.');
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuário ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (!alunoSelecionado) {
        throw new Error('Busque seu nome na lista e selecione — precisa ser o nome exatamente como está na matrícula.');
      }
      if (!username.trim() || !senha) {
        throw new Error('Preencha usuário e senha.');
      }
      if (senha.length < 6) {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      }
      if (!emailPessoal.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPessoal.trim())) {
        throw new Error('Informe um e-mail pessoal válido.');
      }
      if (!aceiteTermos) {
        throw new Error('É preciso aceitar os termos para se cadastrar.');
      }
      await solicitarCadastroBiblioteca({
        username,
        senha,
        nomeInformado: alunoSelecionado.nome,
        dataNascimento: dataNascimento || null,
        turmaId: turmaId || null,
        emailPessoal: emailPessoal.trim(),
        responsavelNome: responsavelNome.trim() || null,
        responsavelContato: responsavelContato.trim() || null,
        aceiteTermos,
        aceiteFuncoesSociais,
        alunoIdSugerido: alunoSelecionado.id,
      });
      // O signUp já deixa uma sessão ativa — segue direto pro app, que mostra a tela
      // de "cadastro em análise" (App.tsx detecta: sessão sem professor e sem papel).
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute top-8 left-8 z-50 text-[#003366] hover:text-[#002677] flex items-center gap-2 transition-all font-black text-sm bg-white px-4 py-2 rounded-xl border border-[#003366]/20 shadow-sm hover:shadow-md active:scale-95"
        >
          &larr; Voltar para o Site
        </button>
      )}

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ms-blue/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ms-blue/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-[#003366] border-b border-white/10 px-8 py-10 text-center">
            <BookOpen className="mx-auto w-12 h-12 text-white mb-4" />
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">BiblioClube JBR</h2>
            <p className="text-blue-100/60 mt-2 text-sm">
              {view === 'LOGIN' ? 'Entre com seu usuário e senha' : 'Criar minha conta de aluno'}
            </p>
          </div>

          <div className="p-8">
            {view === 'LOGIN' ? (
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className={rotuloClasse}>Usuário</label>
                  <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu.usuario" className={campoClasse} />
                </div>
                <div>
                  <label className={rotuloClasse}>Senha</label>
                  <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" className={campoClasse} />
                </div>
                {error && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{error}</div>}
                <button type="submit" disabled={loading} className="w-full bg-ms-blue hover:bg-blue-700 text-white font-bold uppercase tracking-widest py-4 px-4 rounded-lg transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCadastro} className="space-y-4">
                <div className="relative">
                  <label className={rotuloClasse}>Nome completo *</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      required
                      value={alunoSelecionado ? alunoSelecionado.nome : buscaNome}
                      onChange={(e) => handleBuscarNome(e.target.value)}
                      placeholder="Digite pelo menos 3 letras do seu nome..."
                      className={`${campoClasse} pl-9`}
                    />
                    {buscandoNome && <Loader2 className="w-4 h-4 text-gray-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Busque e selecione seu nome como está na matrícula da escola — só quem já é aluno matriculado consegue se cadastrar.
                  </p>
                  {resultadosNome.length > 0 && !alunoSelecionado && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-[#003366]/20 rounded-xl overflow-hidden shadow-xl">
                      {resultadosNome.map((a) => (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => handleSelecionarAluno(a)}
                          className="w-full text-left px-4 py-2.5 text-sm text-[#003366] hover:bg-gray-100 font-medium"
                        >
                          {a.nome} {a.turma_nome && <span className="text-[10px] text-gray-500">· {a.turma_nome}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {buscaNome.trim().length >= 3 && !buscandoNome && resultadosNome.length === 0 && !alunoSelecionado && (
                    <p className="text-[10px] text-amber-600 mt-1">Nenhum aluno encontrado com esse nome — confira a grafia ou fale com a Secretaria.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={rotuloClasse}>Série</label>
                    <select
                      value={serieId}
                      onChange={(e) => { setSerieId(e.target.value); setTurmaId(''); }}
                      className={campoClasse}
                    >
                      <option value="">Todas</option>
                      {series.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={rotuloClasse}>Turma</label>
                    <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={campoClasse}>
                      <option value="">Selecione</option>
                      {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={rotuloClasse}>Nascimento</label>
                    <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={campoClasse} />
                  </div>
                  <div>
                    <label className={rotuloClasse}>E-mail pessoal *</label>
                    <input type="email" required value={emailPessoal} onChange={(e) => setEmailPessoal(e.target.value)} placeholder="voce@email.com" className={campoClasse} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={rotuloClasse}>Usuário desejado *</label>
                    <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu.usuario" className={campoClasse} />
                    <p className="text-[10px] text-gray-500 mt-1">Isso vira seu login — sem espaços/acentos, ex.: joao.silva. Depois é só entrar com ele + sua senha.</p>
                  </div>
                  <div>
                    <label className={rotuloClasse}>Senha *</label>
                    <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres" className={campoClasse} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={rotuloClasse}>Nome do responsável</label>
                    <input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} className={campoClasse} />
                  </div>
                  <div>
                    <label className={rotuloClasse}>Contato do responsável</label>
                    <input value={responsavelContato} onChange={(e) => setResponsavelContato(e.target.value)} placeholder="telefone/WhatsApp" className={campoClasse} />
                  </div>
                </div>

                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={aceiteTermos} onChange={(e) => setAceiteTermos(e.target.checked)} className="mt-0.5" />
                  <span>
                    Li e concordo com os{' '}
                    <button type="button" onClick={() => setMostrarTermos(true)} className="font-bold text-ms-blue underline decoration-ms-blue/30 underline-offset-2">
                      termos de uso
                    </button>{' '}
                    do BiblioClube. Sei que meu cadastro só será ativado depois que a Secretaria confirmar meus dados. *
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={aceiteFuncoesSociais} onChange={(e) => setAceiteFuncoesSociais(e.target.checked)} className="mt-0.5" />
                  Quero participar das funções sociais (resenhas, duplas de leitura, perfil visível para colegas e professores — nunca para a internet).
                </label>

                {error && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{error}</div>}
                {success && <div className="p-3 bg-green-950/20 border border-green-900/50 rounded-lg text-sm text-green-400">{success}</div>}

                <button type="submit" disabled={loading} className="w-full bg-ms-blue hover:bg-blue-700 text-white font-bold uppercase tracking-widest py-4 px-4 rounded-lg transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar cadastro'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 text-center text-sm">
          <button type="button" onClick={() => { setView(view === 'LOGIN' ? 'CADASTRO' : 'LOGIN'); setError(null); setSuccess(null); }} className="text-gray-600 hover:text-gray-800 transition-colors">
            {view === 'LOGIN' ? (
              <>Ainda não tenho conta? <span className="font-bold text-ms-blue underline decoration-ms-blue/30 underline-offset-4">Cadastrar</span></>
            ) : (
              <>Já tenho conta? <span className="font-bold text-ms-blue underline decoration-ms-blue/30 underline-offset-4">Entrar</span></>
            )}
          </button>
          <button type="button" onClick={onVoltar} className="text-gray-500 hover:text-gray-700 transition-colors text-xs">
            &larr; Sou professor/servidor
          </button>
        </div>
      </div>

      {mostrarTermos && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setMostrarTermos(false)}>
          <div className="bg-white max-w-lg w-full max-h-[80vh] rounded-2xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h3 className="text-sm font-black text-[#003366] uppercase tracking-widest">Termos de uso — BiblioClube JBR</h3>
              <button type="button" onClick={() => setMostrarTermos(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto text-xs text-gray-700 space-y-3 leading-relaxed">
              <p><strong>1. O que é o BiblioClube.</strong> É o clube de leitura da biblioteca da escola: você pode consultar o acervo, reservar títulos e, quando o cadastro é aprovado pela Secretaria, retirar livros físicos emprestados no balcão.</p>
              <p><strong>2. Quem pode se cadastrar.</strong> Só alunos já matriculados na escola. O nome usado no cadastro precisa corresponder a um aluno real da matrícula — por isso o formulário pede para buscar e selecionar o próprio nome, em vez de digitá-lo livremente.</p>
              <p><strong>3. Aprovação.</strong> O cadastro só é ativado depois que a Secretaria confirma seus dados. Até lá, sua conta consegue apenas ver o status do pedido.</p>
              <p><strong>4. Empréstimos.</strong> Prazos, limite de renovações e eventual necessidade de reposição em caso de perda/dano do livro seguem as regras internas da biblioteca, informadas no balcão.</p>
              <p><strong>5. Funções sociais (opcional).</strong> Se você marcar a opção de participar das funções sociais (resenhas, duplas de leitura), seu nome e resenhas ficam visíveis para colegas e professores dentro do sistema — nunca publicados na internet.</p>
              <p><strong>6. Dados e privacidade.</strong> Os dados informados aqui (nome, nascimento, responsável) são usados só para a Secretaria confirmar seu vínculo com a escola. O consentimento formal (LGPD), incluindo o de participar das funções sociais, só é registrado no momento em que a Secretaria aprova o cadastro — é esse o ponto em que fica garantido que a família está ciente, no caso de aluno menor de idade.</p>
              <p><strong>7. Conduta.</strong> Use o espaço com respeito — resenhas e interações seguem as mesmas regras de convivência da escola. A Coordenação pode ocultar conteúdo inadequado.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 shrink-0">
              <button type="button" onClick={() => setMostrarTermos(false)} className="w-full bg-ms-blue hover:bg-blue-700 text-white font-bold uppercase tracking-widest py-2.5 rounded-lg transition-all">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
