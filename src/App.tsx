import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Professor } from './types';
import { Login } from './components/Login';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/admin/AdminPanel';
import { CoordinatorDashboard } from './components/CoordinatorDashboard';
import { InspetorDashboard } from './components/InspetorDashboard';
import { LandingPage } from './components/LandingPage';


function App() {
  const [session, setSession] = useState<any>(null);
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('portal-theme') as 'dark' | 'light') || 'dark';
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');

  useEffect(() => {
    localStorage.setItem('portal-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
    
    // Persistência absoluta baseada no ID do Usuário (Auth)
    if (session?.user && professor) {
      const configKey = `portal-config-${session.user.id}`;
      const updates = { 
        theme,
        config_visto_metodo: professor.config_visto_metodo,
        config_visto_valor_total: professor.config_visto_valor_total,
        bimestre_atual: professor.bimestre_atual
      };
      
      localStorage.setItem(configKey, JSON.stringify(updates));

      supabase.from('professores')
        .update(updates)
        .eq('user_id', session.user.id)
        .then(({ error }) => {
          if (error) console.warn('Erro ao sincronizar banco:', error);
        });
    }
  }, [theme, professor, session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setIsAdmin(session.user.email === 'gestaoescolarjbr@gmail.com');
        fetchProfessorProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setIsAdmin(session.user.email === 'gestaoescolarjbr@gmail.com');
        fetchProfessorProfile(session.user.id);
      } else {
        setProfessor(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfessorProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('professores')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!error && data) {
      // Recuperação prioritária pelo ID do Usuário
      const configKey = `portal-config-${userId}`;
      const backup = localStorage.getItem(configKey);
      const configBackup = backup ? JSON.parse(backup) : {};
      
      const mergedProfessor = {
        ...data,
        config_visto_metodo: configBackup.config_visto_metodo || data.config_visto_metodo || 'gradual',
        config_visto_valor_total: configBackup.config_visto_valor_total || data.config_visto_valor_total || 10,
        bimestre_atual: configBackup.bimestre_atual || data.bimestre_atual || 1
      };

      setProfessor(mergedProfessor);
      
      const savedTheme = configBackup.theme || data.theme;
      if (savedTheme && savedTheme !== theme) {
        setTheme(savedTheme as 'dark' | 'light');
      }
    } else {
      console.error('Error fetching professor profile:', error);
      if (session?.user?.email === 'gestaoescolarjbr@gmail.com') {
        try {
          const newProf = {
            user_id: userId,
            nome: 'Administrador Geral',
            email: 'gestaoescolarjbr@gmail.com',
            cargo: 'Diretor',
            theme: theme,
            bimestre_atual: 1,
            config_visto_metodo: 'gradual',
            config_visto_valor_total: 10
          };
          const { data: insertedData, error: insertError } = await supabase
            .from('professores')
            .insert([newProf])
            .select()
            .single();

          if (!insertError && insertedData) {
            setProfessor(insertedData);
          }
        } catch (err) {
          console.error('Error creating admin professor profile:', err);
        }
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ms-dark">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-ms-blue border-t-transparent shadow-[0_0_15px_rgba(0,38,119,0.5)]"></div>
      </div>
    );
  }

  if (!session) {
    if (showLogin) {
      return <Login onLogin={() => setShowLogin(false)} onBack={() => setShowLogin(false)} />;
    }
    return <LandingPage onEnterPortal={() => setShowLogin(true)} />;
  }

  console.log('App State:', { session: !!session, professor: !!professor, isAdmin, view, loading });

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300`}>
      <Header 
        professor={professor} 
        isAdmin={isAdmin}
        onLogout={() => {
          setShowLogin(false);
          setView('dashboard');
        }} 
        onUpdateProfessor={setProfessor}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />
      <main className="flex-1 overflow-auto">
        <div className={isAdmin && view === 'admin' ? "w-full p-4 h-full" : "max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8"}>
          {isAdmin && view === 'admin' ? (
             <AdminPanel onBack={() => setView('dashboard')} theme={theme} />
          ) : professor ? (
            <div className="flex flex-col gap-6">
              {isAdmin && (
                <div className="flex justify-end">
                   <button 
                    onClick={() => setView('admin')}
                    className="flex items-center gap-2 px-4 py-2 bg-ms-gold/20 text-ms-gold border border-ms-gold/30 rounded-lg font-bold hover:bg-ms-gold/30 transition-all shadow-[0_0_15px_rgba(255,183,0,0.1)]"
                   >
                     ⚙️ Painel Admin
                   </button>
                </div>
              )}
              {['Portaria','Inspetor','Auxiliar de Secretaria','Secretário(a)'].includes(professor.cargo) || professor.cargo?.startsWith('Administrativo') ? (
                <InspetorDashboard professor={professor} theme={theme} />
              ) : professor.cargo === 'Coordenador' || professor.cargo === 'Diretor' || professor.cargo === 'Vice-Diretor' ? (
                <CoordinatorDashboard professor={professor} theme={theme} />
              ) : (
                <Dashboard professor={professor} theme={theme} onUpdateProfessor={setProfessor} />
              )}
            </div>
          ) : isAdmin ? (
            <div className="text-center py-20 bg-ms-card rounded-2xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">Bem-vindo, Administrador</h2>
              <p className="text-[#003366] mt-4 max-w-md mx-auto font-bold">Você está logado como administrador geral.</p>
              <button onClick={() => setView('admin')} className="mt-8 px-6 py-2 bg-ms-blue text-white rounded-lg font-bold">Acessar Painel Admin</button>
            </div>
          ) : (
            <div className="text-center py-20 bg-ms-card rounded-2xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">Perfil de professor não encontrado</h2>
              <p className="text-gray-400 mt-4 max-w-md mx-auto">Sua conta não está vinculada a um perfil de professor. Por favor, entre em contato com a administração escolar.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
