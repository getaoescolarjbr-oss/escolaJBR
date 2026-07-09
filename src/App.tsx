import { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Professor } from './types';
import { Login } from './components/Login';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/admin/AdminPanel';
import { CoordinatorDashboard } from './components/CoordinatorDashboard';
import { InspetorDashboard } from './components/InspetorDashboard';
import { LandingPage } from './components/LandingPage';
import { getCurrentBimestre } from './utils/academicUtils';
import { useAuth } from './hooks/useAuth';
import { RequireRole } from './components/rbac/RequireRole';
import { ModuleShell } from './components/shell/ModuleShell';
import { PessoasPanel } from './components/pessoas/PessoasPanel';
import { LgpdPanel } from './components/lgpd/LgpdPanel';
import { UsuariosPanel } from './components/usuarios/UsuariosPanel';
import { PerfilPanel } from './components/perfil/PerfilPanel';
import { SecretariaPanel } from './components/secretaria/SecretariaPanel';
import { CozinhaPanel } from './components/cozinha/CozinhaPanel';
import { AgendamentoPanel } from './components/agendamento/AgendamentoPanel';
import { BibliotecaPanel } from './components/biblioteca/BibliotecaPanel';
import { AlunoHome } from './components/aluno/AlunoHome';
import { CadastroPendenteScreen } from './components/aluno/CadastroPendenteScreen';
import { GestaoEscolarPanel } from './components/gestaoEscolar/GestaoEscolarPanel';
import { MODULOS_NAV, modulosVisiveis } from './config/moduleNav';

const MODULOS_COM_SHELL = ['pessoas', 'secretaria', 'cozinha', 'agendamento', 'biblioteca', 'gestao', 'lgpd', 'usuarios', 'perfil'] as const;
type ModuloComShell = (typeof MODULOS_COM_SHELL)[number];

const TITULOS_MODULO: Record<ModuloComShell, { titulo: string; subtitulo?: string }> = {
  pessoas: { titulo: 'Cadastro de Pessoas', subtitulo: 'Identidade central — Alunos, Servidores e Responsáveis' },
  secretaria: { titulo: 'Secretaria', subtitulo: 'Matrícula, documentos, emissão e protocolo' },
  cozinha: { titulo: 'Cozinha', subtitulo: 'Cardápio, estoque, fornecedores e indicadores PNAE' },
  agendamento: { titulo: 'Agendamento de Recursos', subtitulo: 'Recursos, bloqueios de manutenção e reservas' },
  biblioteca: { titulo: 'Biblioteca', subtitulo: 'Acervo, empréstimos e clube de leitura' },
  gestao: { titulo: 'Gestão Escolar', subtitulo: 'Indicadores, Almoxarifado e demais sub-módulos administrativos' },
  lgpd: { titulo: 'LGPD — Exportar e Excluir Dados', subtitulo: 'Solicitações de titulares de dados' },
  usuarios: { titulo: 'Usuários e Funções', subtitulo: 'Controle de acesso (RBAC)' },
  perfil: { titulo: 'Minha Conta', subtitulo: 'Seus dados e senha' },
};


function App() {
  const { session, hasRole, hasAnyRole, papeis, loading: authLoading } = useAuth();
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  // Atalho "Biblioteca" do Acesso Rápido da LandingPage abre o login já no modo
  // BiblioClube (aluno), em vez do login padrão de servidor.
  const [loginModoAluno, setLoginModoAluno] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('portal-theme') as 'dark' | 'light') || 'light';
  });
  // Fonte de verdade agora é o RBAC no banco (usuario_papeis), não mais um e-mail
  // hardcoded. Ver backfill_fundacao_papeis.sql para a atribuição de GESTAO.
  const isAdmin = hasRole('GESTAO');
  const [view, setView] = useState<'dashboard' | 'admin' | 'coordenacao' | 'inspetoria' | ModuloComShell>(() => {
    const modulo = new URLSearchParams(window.location.search).get('modulo');
    if (modulo === 'admin' || modulo === 'coordenacao' || modulo === 'inspetoria') return modulo;
    return modulo && (MODULOS_COM_SHELL as readonly string[]).includes(modulo) ? (modulo as ModuloComShell) : 'dashboard';
  });

  function navegarPara(modulo: string) {
    setView(modulo as 'dashboard' | 'admin' | 'coordenacao' | 'inspetoria' | ModuloComShell);
    window.history.replaceState({}, '', modulo === 'dashboard' ? '/' : `/?modulo=${modulo}`);
  }
  const [forceLanding, setForceLanding] = useState(() => new URLSearchParams(window.location.search).has('home'));

  // Continuidade de link direto (ex.: home pública -> "Agendar" -> login):
  // o `view` só é lido da URL uma vez, no mount inicial (antes do login existir).
  // Quando a sessão aparece pela primeira vez, relê a URL para não perder o destino
  // (ex.: ?modulo=agendamento&recurso=<id>) que o usuário tinha antes de logar.
  const sincronizouViewPosLogin = useRef(false);
  useEffect(() => {
    if (session?.user && !sincronizouViewPosLogin.current) {
      sincronizouViewPosLogin.current = true;
      const modulo = new URLSearchParams(window.location.search).get('modulo');
      if (modulo && (MODULOS_COM_SHELL as readonly string[]).includes(modulo)) {
        const timeout = setTimeout(() => setView(modulo as ModuloComShell), 0);
        return () => clearTimeout(timeout);
      }
    }
    if (!session) {
      sincronizouViewPosLogin.current = false;
    }
  }, [session]);

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
    if (authLoading) return;
    Promise.resolve().then(() => {
      // Aluno não tem linha em `professores` — pular a busca evita 3 consultas
      // inúteis (ver fetchProfessorProfile) e cai direto na home do aluno.
      if (session?.user && !hasRole('ALUNO')) {
        return fetchProfessorProfile(session.user.id);
      }
      setProfessor(null);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, authLoading]);

  const fetchProfessorProfile = async (userId: string) => {
    // 1ª tentativa: buscar pelo user_id
    const { data, error } = await supabase
      .from('professores')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!error && data) {
      // Encontrou pelo user_id — fluxo normal
      const configKey = `portal-config-${userId}`;
      const backup = localStorage.getItem(configKey);
      const configBackup = backup ? JSON.parse(backup) : {};
      
      const mergedProfessor = {
        ...data,
        config_visto_metodo: configBackup.config_visto_metodo || data.config_visto_metodo || 'gradual',
        config_visto_valor_total: configBackup.config_visto_valor_total || data.config_visto_valor_total || 10,
        bimestre_atual: getCurrentBimestre()
      };

      setProfessor(mergedProfessor);
      
      const savedTheme = configBackup.theme || data.theme;
      if (savedTheme && savedTheme !== theme) {
        setTheme(savedTheme as 'dark' | 'light');
      }
      setLoading(false);
      return;
    }

    // 2ª tentativa: fallback por email (resolve race condition do cadastro)
    // Isso ocorre quando signUp() dispara onAuthStateChange antes do UPDATE user_id terminar
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const userEmail = authUser?.email;

    if (userEmail) {
      const { data: profByEmail, error: emailError } = await supabase
        .from('professores')
        .select('*')
        .eq('email', userEmail)
        .is('user_id', null)  // só vincula se ainda não tiver user_id
        .maybeSingle();

      if (!emailError && profByEmail) {
        console.log('Perfil encontrado por email, vinculando user_id...');
        // Vincula o user_id automaticamente (correção da race condition)
        await supabase
          .from('professores')
          .update({ user_id: userId })
          .eq('id', profByEmail.id);

        const configKey = `portal-config-${userId}`;
        const backup = localStorage.getItem(configKey);
        const configBackup = backup ? JSON.parse(backup) : {};

        const mergedProfessor = {
          ...profByEmail,
          user_id: userId,
          config_visto_metodo: configBackup.config_visto_metodo || profByEmail.config_visto_metodo || 'gradual',
          config_visto_valor_total: configBackup.config_visto_valor_total || profByEmail.config_visto_valor_total || 10,
          bimestre_atual: getCurrentBimestre()
        };

        setProfessor(mergedProfessor);
        setLoading(false);
        return;
      }

      // 3ª tentativa: email já tem user_id (outro usuário ou já foi vinculado mas com ID diferente)
      // Tenta buscar sem o filtro .is('user_id', null) para diagnóstico
      const { data: profAnyStatus } = await supabase
        .from('professores')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      if (profAnyStatus && profAnyStatus.user_id && profAnyStatus.user_id !== userId) {
        // user_id diferente: atualiza para o atual (pode ocorrer se a conta foi recriada)
        console.warn('user_id divergente detectado, corrigindo...');
        await supabase
          .from('professores')
          .update({ user_id: userId })
          .eq('id', profAnyStatus.id);

        setProfessor({ ...profAnyStatus, user_id: userId });
        setLoading(false);
        return;
      }
    }

    console.error('Error fetching professor profile:', error);
    if (session?.user?.email === 'gestaoescolarjbr@gmail.com') {
      try {
        const newProf = {
          user_id: userId,
          nome: 'Administrador Geral',
          email: 'gestaoescolarjbr@gmail.com',
          cargo: 'Diretor',
          theme: theme,
          bimestre_atual: getCurrentBimestre(),
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
    setLoading(false);
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ms-dark">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-ms-blue border-t-transparent shadow-[0_0_15px_rgba(0,38,119,0.5)]"></div>
      </div>
    );
  }

  // Atalho "Biblioteca": se já existe sessão (servidor ou aluno), não faz sentido
  // pedir login de novo — navega direto pro módulo. Só quem ainda não está logado
  // cai na tela de login em modo BiblioClube.
  function handleEnterPortal(destino?: 'aluno') {
    setForceLanding(false);
    if (destino === 'aluno' && session) {
      navegarPara('biblioteca');
      return;
    }
    setLoginModoAluno(destino === 'aluno');
    if (!session) setShowLogin(true);
    window.history.replaceState({}, '', '/');
  }

  if (forceLanding) {
    return <LandingPage onEnterPortal={handleEnterPortal} />;
  }

  if (!session) {
    if (showLogin) {
      return <Login onLogin={() => setShowLogin(false)} onBack={() => setShowLogin(false)} modoInicial={loginModoAluno ? 'aluno' : 'servidor'} />;
    }
    return <LandingPage onEnterPortal={handleEnterPortal} />;
  }

  // Aluno tem uma "app" própria (BiblioClube), sem Header/ModuleShell de servidor —
  // ver App.tsx useEffect acima, que já pula fetchProfessorProfile para este papel.
  if (hasRole('ALUNO')) {
    return <AlunoHome onLogout={() => setView('dashboard')} />;
  }

  // Sessão sem professor, sem admin e sem NENHUM papel: é o autocadastro do
  // BiblioClube ainda não aprovado pela Secretaria (ou rejeitado) — nunca um
  // professor "perdido", que é o que a mensagem genérica mais abaixo pressupõe.
  if (!professor && !isAdmin && papeis.length === 0) {
    return <CadastroPendenteScreen authUserId={session.user.id} onLogout={() => setView('dashboard')} />;
  }

  console.log('App State:', { session: !!session, professor: !!professor, isAdmin, view, loading });

  // Rótulo de contexto do cabeçalho: derivado de rota/papel, nunca de professor.cargo
  // como se fosse nível de acesso (era a causa de um GESTAO aparecer "Coordenador" —
  // o cargo real dessa conta no banco). GESTAO nunca mais cai no fallback de cargo
  // (último `return`), porque sempre aterrissa no hub agora.
  function contextoAtual(): string {
    if (isAdmin && view === 'admin') return 'Painel Admin';
    if (view === 'coordenacao') return 'Visão: Coordenação';
    if (view === 'inspetoria') return 'Visão: Portaria/Inspetoria';
    if ((MODULOS_COM_SHELL as readonly string[]).includes(view)) return TITULOS_MODULO[view as ModuloComShell].titulo;
    if (hasRole('GESTAO')) return 'Portal do Administrador';
    return professor?.cargo ?? '';
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300`}>
      <Header
        professor={professor}
        isAdmin={isAdmin}
        contexto={contextoAtual()}
        onLogout={() => {
          setShowLogin(false);
          setView('dashboard');
        }}
        onUpdateProfessor={setProfessor}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />
      <main className="flex-1 overflow-auto">
        <div className={(isAdmin && view === 'admin') || (MODULOS_COM_SHELL as readonly string[]).includes(view) ? "w-full p-4 h-full" : "max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8"}>
          {isAdmin && view === 'admin' ? (
             <AdminPanel onBack={() => navegarPara('dashboard')} theme={theme} />
          ) : view === 'coordenacao' && hasAnyRole(['GESTAO', 'COORDENACAO']) && professor ? (
            <div className="space-y-4">
              <button
                onClick={() => navegarPara('dashboard')}
                className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-ms-main transition-colors"
              >
                &larr; Voltar ao Portal
              </button>
              <CoordinatorDashboard professor={professor} theme={theme} />
            </div>
          ) : view === 'inspetoria' && hasAnyRole(['GESTAO', 'INSPETOR']) && professor ? (
            <div className="space-y-4">
              <button
                onClick={() => navegarPara('dashboard')}
                className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-ms-main transition-colors"
              >
                &larr; Voltar ao Portal
              </button>
              <InspetorDashboard professor={professor} theme={theme} />
            </div>
          ) : (MODULOS_COM_SHELL as readonly string[]).includes(view) ? (
            (() => {
              const modulo = view as ModuloComShell;
              const item = MODULOS_NAV.find((m) => m.id === modulo);
              const conteudo = (
                <ModuleShell
                  activeModulo={modulo}
                  titulo={TITULOS_MODULO[modulo].titulo}
                  subtitulo={TITULOS_MODULO[modulo].subtitulo}
                  onNavigate={navegarPara}
                  onVoltarInicio={() => navegarPara('dashboard')}
                >
                  {modulo === 'pessoas' && <PessoasPanel />}
                  {modulo === 'lgpd' && <LgpdPanel />}
                  {modulo === 'usuarios' && <UsuariosPanel />}
                  {modulo === 'secretaria' && <SecretariaPanel />}
                  {modulo === 'cozinha' && <CozinhaPanel />}
                  {modulo === 'agendamento' && <AgendamentoPanel />}
                  {modulo === 'biblioteca' && <BibliotecaPanel />}
                  {modulo === 'gestao' && <GestaoEscolarPanel />}
                  {modulo === 'perfil' && <PerfilPanel />}
                </ModuleShell>
              );
              return item?.roles ? (
                <RequireRole anyOf={item.roles} fallback={<p className="text-gray-400 p-8">Sem permissão para acessar este módulo.</p>}>
                  {conteudo}
                </RequireRole>
              ) : conteudo;
            })()
          ) : professor && hasRole('GESTAO') ? (
            // GESTAO sempre aterrissa no hub de cards — nunca mais na landing por
            // cargo (era o que o levava direto pro CoordinatorDashboard quando o
            // cargo cadastrado era "Coordenador"/"Diretor"/"Vice-Diretor"). "Visão
            // Coordenação" e "Painel Admin" viram cards como qualquer outro módulo.
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-ms-main">Portal do Administrador</h2>
                <p className="text-sm text-gray-500">Escolha um módulo para continuar.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {modulosVisiveis(hasAnyRole).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navegarPara(item.id)}
                    className="flex flex-col items-center gap-2 p-6 bg-ms-card border border-gray-800 rounded-2xl hover:border-ms-blue transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue text-center"
                  >
                    <item.icon className="w-7 h-7 text-ms-blue" />
                    <span className="text-sm font-bold text-ms-main">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : professor ? (
            <div className="flex flex-col gap-6">
              {modulosVisiveis(hasAnyRole).length > 0 && (
                <div className="flex justify-end gap-3 flex-wrap">
                   {modulosVisiveis(hasAnyRole).map((item) => (
                     <button
                      key={item.id}
                      onClick={() => navegarPara(item.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ms-blue"
                     >
                       <item.icon className="w-4 h-4" /> {item.label}
                     </button>
                   ))}
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
