import { useEffect, useState } from 'react';
import { Clock, XCircle, Loader2, BookOpen } from 'lucide-react';
import { signOut } from '../../services/authService';
import { meuCadastroPendente } from '../../services/cadastroBibliotecaService';

interface CadastroPendenteScreenProps {
  authUserId: string;
  onLogout: () => void;
}

// Mostrada quando existe sessão mas nenhum papel ainda (aluno recém-cadastrado, antes
// da Secretaria aprovar) — evita cair na tela genérica de "perfil de professor não
// encontrado", que não faz sentido pra este caso.
export function CadastroPendenteScreen({ authUserId, onLogout }: CadastroPendenteScreenProps) {
  const [status, setStatus] = useState<'PENDENTE' | 'REJEITADO' | 'DESCONHECIDO' | null>(null);
  const [observacoes, setObservacoes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        const cadastro = await meuCadastroPendente(authUserId);
        setStatus(cadastro ? (cadastro.status === 'APROVADO' ? 'DESCONHECIDO' : cadastro.status) : 'DESCONHECIDO');
        setObservacoes(cadastro?.observacoes_analise ?? null);
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [authUserId]);

  async function handleLogout() {
    await signOut();
    onLogout();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ms-dark p-6">
      <div className="max-w-md w-full text-center bg-ms-card border border-gray-800 rounded-2xl p-8">
        <BookOpen className="mx-auto w-10 h-10 text-ms-blue mb-4" />
        {loading ? (
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blue" />
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
              Recebemos seu pedido para o BiblioClube! A Secretaria vai conferir seus dados de matrícula antes de liberar
              o acesso. Volte a tentar entrar em alguns dias.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-ms-main">Sua conta ainda não tem acesso liberado</h1>
            <p className="text-sm text-gray-400 mt-2">Fale com a Secretaria da escola.</p>
          </>
        )}
        <button onClick={handleLogout} className="mt-6 px-6 py-2 bg-ms-blue text-white rounded-lg font-bold">Sair</button>
      </div>
    </div>
  );
}
