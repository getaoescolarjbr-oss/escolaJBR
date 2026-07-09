import { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { signInWithPassword } from '../services/authService';
import { solicitarCadastroBiblioteca, resolverEmailPorUsername } from '../services/cadastroBibliotecaService';
import { listarTurmas } from '../services/agendamentoService';

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

  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [nomeInformado, setNomeInformado] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelContato, setResponsavelContato] = useState('');
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [aceiteFuncoesSociais, setAceiteFuncoesSociais] = useState(false);

  useEffect(() => {
    if (view === 'CADASTRO' && turmas.length === 0) {
      listarTurmas().then(setTurmas).catch(() => {});
    }
  }, [view, turmas.length]);

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
      if (!username.trim() || !senha || !nomeInformado.trim()) {
        throw new Error('Preencha usuário, senha e nome completo.');
      }
      if (senha.length < 6) {
        throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      }
      if (!aceiteTermos) {
        throw new Error('É preciso aceitar os termos para se cadastrar.');
      }
      await solicitarCadastroBiblioteca({
        username,
        senha,
        nomeInformado: nomeInformado.trim(),
        dataNascimento: dataNascimento || null,
        turmaId: turmaId || null,
        responsavelNome: responsavelNome.trim() || null,
        responsavelContato: responsavelContato.trim() || null,
        aceiteTermos,
        aceiteFuncoesSociais,
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
                <div>
                  <label className={rotuloClasse}>Nome completo *</label>
                  <input required value={nomeInformado} onChange={(e) => setNomeInformado(e.target.value)} className={campoClasse} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={rotuloClasse}>Nascimento</label>
                    <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={campoClasse} />
                  </div>
                  <div>
                    <label className={rotuloClasse}>Turma</label>
                    <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={campoClasse}>
                      <option value="">Selecione</option>
                      {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={rotuloClasse}>Usuário desejado *</label>
                    <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu.usuario" className={campoClasse} />
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
                  Li e concordo com os termos de uso do BiblioClube. Sei que meu cadastro só será ativado depois que a Secretaria confirmar meus dados. *
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
    </div>
  );
}
