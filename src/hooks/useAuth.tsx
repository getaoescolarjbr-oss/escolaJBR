import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchMeusPapeis } from '../services/authService';
import type { Papel } from '../types/rbac';

interface AuthContextValue {
  session: Session | null;
  usuarioId: string | null;
  papeis: Papel[];
  loading: boolean;
  hasRole: (papel: Papel) => boolean;
  hasAnyRole: (papeis: Papel[]) => boolean;
  refreshPapeis: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Fonte única de sessão + papéis para todo o app. Módulos futuros (Secretaria,
// Biblioteca, Agendamento, Gestão) usam useAuth()/hasRole() em vez de reimplementar
// checagem de acesso — mas o bloqueio de verdade é a RLS no Postgres; isto aqui só
// decide o que a interface mostra.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarPapeis = async (userId: string) => {
    setPapeis(await fetchMeusPapeis(userId));
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        carregarPapeis(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        carregarPapeis(session.user.id);
      } else {
        setPapeis([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (papel: Papel) => papeis.includes(papel);
  const hasAnyRole = (lista: Papel[]) => lista.some((p) => papeis.includes(p));

  return (
    <AuthContext.Provider
      value={{
        session,
        usuarioId: session?.user?.id ?? null,
        papeis,
        loading,
        hasRole,
        hasAnyRole,
        refreshPapeis: async () => {
          if (session?.user) await carregarPapeis(session.user.id);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa ser usado dentro de <AuthProvider>');
  return ctx;
}
