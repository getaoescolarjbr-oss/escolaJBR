import { useCallback, useEffect, useState } from 'react';
import { Clock, XCircle, Loader2, BookOpen } from 'lucide-react';
import { signOut } from '../../services/authService';
import { meuCadastroPendente } from '../../services/cadastroBibliotecaService';
import { criarCadastroDosMetadados, meuCadastroServidor, type CadastroServidorPendente } from '../../services/cadastroServidorService';
import { CadastroServidorRascunho } from '../cadastroServidor/CadastroServidorRascunho';
import { RefazerCadastroServidor } from '../cadastroServidor/RefazerCadastroServidor';

interface CadastroPendenteScreenProps {
  authUserId: string;
  onLogout: () => void;
}

type Situacao = 'PENDENTE' | 'REJEITADO' | 'APROVADO_SERVIDOR' | 'DESCONHECIDO' | null;

// Mostrada quando existe sessão mas nenhum papel ainda (servidor ou aluno recém-cadastrado,
// antes da aprovação) — evita cair na tela genérica de "perfil de professor não encontrado".
// Servidor com cadastro ainda em RASCUNHO cai direto na etapa de envio de documentos.
export function CadastroPendenteScreen({ authUserId, onLogout }: CadastroPendenteScreenProps) {
  const [status, setStatus] = useState<Situacao>(null);
  const [ehServidor, setEhServidor] = useState(false);
  const [observacoes, setObservacoes] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<CadastroServidorPendente | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [refazendo, setRefazendo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      // Servidor (Portal do Servidor) primeiro; se não houver pedido, é o aluno do BiblioClube.
      let servidor = await meuCadastroServidor(authUserId);
      // Cadastro feito com a confirmação de e-mail ligada: o pedido nasce agora, no primeiro login.
      if (!servidor && (await criarCadastroDosMetadados())) servidor = await meuCadastroServidor(authUserId);
      if (servidor) {
        setEhServidor(true);
        setRascunho(servidor.status === 'RASCUNHO' ? servidor : null);
        setStatus(servidor.status === 'APROVADO' ? 'APROVADO_SERVIDOR' : servidor.status === 'RASCUNHO' ? null : servidor.status);
        setObservacoes(servidor.observacoes_analise);
        return;
      }
      const cadastro = await meuCadastroPendente(authUserId);
      setStatus(cadastro ? (cadastro.status === 'APROVADO' ? 'DESCONHECIDO' : cadastro.status) : 'DESCONHECIDO');
      setObservacoes(cadastro?.observacoes_analise ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar seu cadastro.');
    } finally {
      setLoading(false);
    }
  }, [authUserId]);

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, [carregar]);

  async function handleLogout() {
    await signOut();
    onLogout();
  }

  if (rascunho) {
    return <CadastroServidorRascunho cadastro={rascunho} onRecarregar={carregar} onLogout={onLogout} />;
  }

  if (refazendo) {
    return (
      <div className="min-h-screen bg-ms-dark p-4 sm:p-6">
        <div className="max-w-lg mx-auto">
          <RefazerCadastroServidor onCancelar={() => setRefazendo(false)} onCriado={() => { setRefazendo(false); setLoading(true); void carregar(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ms-dark p-6">
      <div className="max-w-md w-full text-center bg-ms-card border border-gray-800 rounded-2xl p-8">
        <BookOpen className="mx-auto w-10 h-10 text-ms-blueText mb-4" />
        {loading ? (
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
        ) : status === 'APROVADO_SERVIDOR' ? (
          <>
            <h1 className="text-lg font-bold text-ms-main">Cadastro aprovado!</h1>
            <p className="text-sm text-gray-400 mt-2">Seu acesso foi liberado. Toque em Sair e entre novamente.</p>
          </>
        ) : status === 'REJEITADO' ? (
          <>
            <XCircle className="mx-auto w-10 h-10 text-red-400 mb-3" />
            <h1 className="text-lg font-bold text-ms-main">Cadastro não aprovado</h1>
            <p className="text-sm text-gray-400 mt-2">
              A Secretaria não conseguiu confirmar seus dados. {observacoes && `Motivo: ${observacoes}`}
            </p>
            <p className="text-sm text-gray-400 mt-2">Procure a Secretaria da escola para regularizar.</p>
          </>
        ) : status === 'PENDENTE' ? (
          <>
            <Clock className="mx-auto w-10 h-10 text-amber-400 mb-3" />
            <h1 className="text-lg font-bold text-ms-main">Cadastro em análise</h1>
            <p className="text-sm text-gray-400 mt-2">
              {ehServidor
                ? 'Recebemos seu cadastro e seus documentos! A Secretaria ou a Gestão vai conferir tudo antes de liberar o acesso. Volte a entrar em alguns dias.'
                : 'Recebemos seu pedido para o BiblioClube! A Secretaria vai conferir seus dados de matrícula antes de liberar o acesso. Volte a tentar entrar em alguns dias.'}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-ms-main">Sua conta ainda não tem acesso liberado</h1>
            <p className="text-sm text-gray-400 mt-2">Fale com a Secretaria da escola.</p>
            {erro && <p className="text-xs text-red-400 mt-3">{erro}</p>}
            <button onClick={() => setRefazendo(true)} className="mt-4 text-xs font-bold text-ms-blueText underline underline-offset-2">
              Sou servidor da escola e preciso refazer meu cadastro
            </button>
          </>
        )}
        <button onClick={handleLogout} className="mt-6 px-6 py-2 bg-ms-blue text-white rounded-lg font-bold">Sair</button>
      </div>
    </div>
  );
}
