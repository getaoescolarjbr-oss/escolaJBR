import React from 'react';
import { 
  Calendar, BookOpen, Clock, FileText, Users, LogIn, Phone, MapPin, Mail, 
  Globe, Award, Trophy, ChevronRight, Newspaper, Layers, GraduationCap, 
  Home, BarChart3, UserCheck, ClipboardList, Building2, Lock, Leaf, Cake,
  User, Landmark, Rocket, Handshake, Lightbulb, Heart, Target
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CalendarioLetivoModal } from './CalendarioLetivoModal';
import { CardapioPublicoModal } from './CardapioPublicoModal';
import { ContatoModal } from './ContatoModal';
import { MatriculaInfoModal } from './MatriculaInfoModal';
import { EmBreveModal } from './EmBreveModal';
import { AgendaPublicaModal } from './AgendaPublicaModal';
import { listarRecursos } from '../services/agendamentoService';
import type { Recurso } from '../types/agendamento';
import { calendarData } from '../data/calendarData';
import './LandingPage.css';

interface LandingPageProps {
  // 'aluno' abre o login já no modo BiblioClube (AlunoAuth), em vez do login padrão
  // de servidor — usado pelo atalho "Biblioteca" do Acesso Rápido.
  onEnterPortal: (destino?: 'aluno') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterPortal }) => {
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null);
  const [news, setNews] = React.useState<any[]>([]);
  const [events, setEvents] = React.useState<any[]>([]);
  const [warnings, setWarnings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);
  const [showCalendarModal, setShowCalendarModal] = React.useState(false);
  const [showCardapioModal, setShowCardapioModal] = React.useState(false);
  const [showContatoModal, setShowContatoModal] = React.useState(false);
  const [showMatriculaModal, setShowMatriculaModal] = React.useState(false);
  const [emBreveTitulo, setEmBreveTitulo] = React.useState<string | null>(null);
  const [recursos, setRecursos] = React.useState<Recurso[]>([]);
  const [recursoAgendaAberta, setRecursoAgendaAberta] = React.useState<Recurso | null>(null);

  React.useEffect(() => {
    fetchLandingData();
  }, []);

  // Recursos (Lab. Ciências, Lab. Informática, Quadra Esportiva, ...) são públicos —
  // busca a lista para ligar os cards de Acesso Rápido à agenda de verdade, e para
  // suportar o link direto ?modulo=agendamento&recurso=<id> (compartilhável).
  React.useEffect(() => {
    listarRecursos()
      .then((lista) => {
        setRecursos(lista);
        const params = new URLSearchParams(window.location.search);
        const recursoIdNaUrl = params.get('modulo') === 'agendamento' ? params.get('recurso') : null;
        if (recursoIdNaUrl) {
          const encontrado = lista.find((r) => r.id === recursoIdNaUrl);
          if (encontrado) setRecursoAgendaAberta(encontrado);
        }
      })
      .catch(console.error);
  }, []);

  function abrirAgendaDoRecurso(trechoNome: string) {
    const encontrado = recursos.find((r) => r.nome.toLowerCase().includes(trechoNome.toLowerCase()));
    if (!encontrado) {
      setEmBreveTitulo('Agendamento');
      return;
    }
    setRecursoAgendaAberta(encontrado);
    window.history.replaceState({}, '', `/?modulo=agendamento&recurso=${encontrado.id}`);
  }

  const syncInstagramFeed = async () => {
    try {
      // 1. Buscar a configuração do feed do Instagram no banco
      const { data: configData, error: configErr } = await supabase
        .from('landing_avisos')
        .select('*')
        .eq('titulo', 'INSTAGRAM_FEED_CONFIG')
        .eq('cor_alerta', 'config')
        .maybeSingle();

      if (configErr || !configData || !configData.mensagem) {
        return;
      }

      const feedUrl = configData.mensagem.trim();
      if (!feedUrl.startsWith('http://') && !feedUrl.startsWith('https://')) {
        return;
      }

      // 2. Buscar o feed JSON do Behold
      const response = await fetch(feedUrl);
      if (!response.ok) {
        console.error('Falha ao buscar feed do Instagram:', response.statusText);
        return;
      }
      
      const feedData = await response.json();
      const posts = Array.isArray(feedData) ? feedData : (feedData.posts || feedData.data || []);
      if (posts.length === 0) return;

      // 3. Buscar URLs das postagens do Instagram já existentes no banco
      const { data: existingNoticias, error: selectErr } = await supabase
        .from('landing_noticias')
        .select('conteudo')
        .eq('categoria', 'INSTAGRAM');

      if (selectErr) {
        console.error('Erro ao buscar posts existentes do banco:', selectErr);
        return;
      }

      const existingUrls = new Set(
        (existingNoticias || [])
          .map((n: any) => n.conteudo?.trim())
          .filter(Boolean)
      );

      // 4. Filtrar as postagens do feed que ainda não estão cadastradas
      const newPosts = [];
      for (const post of posts) {
        const permalink = (post.permalink || post.link || '').trim();
        if (!permalink) continue;

        if (!existingUrls.has(permalink)) {
          const caption = post.caption || post.legend || '';
          
          let titulo = 'Publicação do Instagram';
          if (caption) {
            const cleanCaption = caption.replace(/#\w+/g, '').trim();
            const lines = cleanCaption.split('\n');
            const firstLine = lines[0].trim();
            if (firstLine) {
              titulo = firstLine.length > 65 ? firstLine.slice(0, 62) + '...' : firstLine;
            }
          }

          let dataPublicacao = new Date().toISOString();
          if (post.timestamp || post.created_at || post.date) {
            try {
              dataPublicacao = new Date(post.timestamp || post.created_at || post.date).toISOString();
            } catch (dErr) {
              // fallback
            }
          }

          const mediaUrl = post.mediaUrl || post.media_url || '';

          newPosts.push({
            titulo,
            subtitulo: caption.length > 300 ? caption.slice(0, 297) + '...' : caption,
            conteudo: permalink,
            imagem_url: mediaUrl,
            categoria: 'INSTAGRAM',
            data_publicacao: dataPublicacao
          });
        }
      }

      // 5. Se houver novas postagens, inseri-las no banco em lote
      if (newPosts.length > 0) {
        console.log(`[Instagram Sync] Sincronizando ${newPosts.length} novas postagens...`);
        const { error: insertErr } = await supabase
          .from('landing_noticias')
          .insert(newPosts);

        if (insertErr) {
          console.error('Erro ao inserir novas postagens do Instagram:', insertErr);
        } else {
          console.log('[Instagram Sync] Sincronização concluída com sucesso!');
          // Atualizar o estado local imediatamente
          const { data: updatedNews } = await supabase
            .from('landing_noticias')
            .select('*')
            .order('data_publicacao', { ascending: false })
            .limit(6);
          if (updatedNews) setNews(updatedNews);
        }
      }
    } catch (err) {
      console.error('Erro durante a sincronização do feed do Instagram:', err);
    }
  };

  const fetchInstagramPosts = async () => {
    try {
      const { data: configData } = await supabase.from('landing_avisos').select('*').eq('titulo', 'INSTAGRAM_FEED_CONFIG').eq('cor_alerta', 'config').maybeSingle();
      if (!configData || !configData.mensagem) return [];
      const feedUrl = configData.mensagem.trim();
      if (!feedUrl.startsWith('http')) return [];
      const response = await fetch(feedUrl);
      if (!response.ok) return [];
      const feedData = await response.json();
      const posts = Array.isArray(feedData) ? feedData : (feedData.posts || feedData.data || []);
      const mappedPosts = [];
      for (const post of posts) {
        const permalink = (post.permalink || post.link || '').trim();
        if (!permalink) continue;
        const caption = post.caption || post.legend || '';
        let titulo = 'Publicação do Instagram';
        if (caption) {
          const cleanCaption = caption.replace(/#\w+/g, '').trim();
          const firstLine = cleanCaption.split('\n')[0].trim();
          if (firstLine) titulo = firstLine.length > 65 ? firstLine.slice(0, 62) + '...' : firstLine;
        }
        let dataPublicacao = new Date().toISOString();
        if (post.timestamp || post.created_at || post.date) {
          try { dataPublicacao = new Date(post.timestamp || post.created_at || post.date).toISOString(); } catch (dErr) { }
        }
        mappedPosts.push({
          id: `insta-${post.id || permalink}`, titulo,
          subtitulo: caption.length > 300 ? caption.slice(0, 297) + '...' : caption,
          conteudo: permalink, imagem_url: post.sizes?.large?.mediaUrl || post.sizes?.medium?.mediaUrl || post.thumbnailUrl || post.mediaUrl || post.media_url || '',
          categoria: 'INSTAGRAM', data_publicacao: dataPublicacao
        });
      }
      return mappedPosts;
    } catch (err) {
      return [];
    }
  };

  const fetchLandingData = async () => {
    try {
      setLoading(true);
      const [newsRes, eventsRes, warningsRes, instaPosts] = await Promise.all([
        supabase.from('landing_noticias').select('*').order('data_publicacao', { ascending: false }).limit(6),
        supabase.from('landing_eventos').select('*').order('data_evento', { ascending: true }).limit(4),
        supabase.from('landing_avisos').select('*').neq('cor_alerta', 'config').order('created_at', { ascending: false }).limit(3),
        fetchInstagramPosts()
      ]);

      let allNews: any[] = [];
      if (newsRes.data) allNews = [...newsRes.data];
      if (instaPosts && instaPosts.length > 0) {
        allNews = [...allNews, ...instaPosts];
        // Sort by date descending and limit to 6
        allNews.sort((a, b) => new Date(b.data_publicacao).getTime() - new Date(a.data_publicacao).getTime());
        allNews = allNews.slice(0, 6);
      }
      setNews(allNews);
      if (warningsRes.data) setWarnings(warningsRes.data);

      let calEventsData: any[] = [];
      try {
        const { data } = await supabase.from('calendario_eventos').select('*');
        calEventsData = data || [];
      } catch (calErr) {
        console.error('Erro ao buscar eventos do calendário:', calErr);
      }

      const customCalMap: Record<string, any> = {};
      calEventsData.forEach((e: any) => {
        if (e && e.data) {
          customCalMap[e.data] = e;
        }
      });

      // Mesclar eventos do banco de dados com eventos fixos do calendário (próximos 30 dias)
      let mergedEvents: any[] = eventsRes.data ? [...eventsRes.data] : [];

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const next30Days = new Date(today);
        next30Days.setDate(next30Days.getDate() + 30);
        
        // Mesclar dados estáticos com os personalizados
        const allDates = new Set([...Object.keys(calendarData), ...Object.keys(customCalMap)]);

        allDates.forEach((dateStr) => {
          const custom = customCalMap[dateStr];
          const data = calendarData[dateStr];
          const currentData = custom || data;

          if (!currentData) return;

          let parsedCat = currentData.categoria;
          if (parsedCat && parsedCat.includes(':')) {
            parsedCat = parsedCat.split(':')[0];
          }

          // Ignorar dias normais e dias sem descrição relevante
          if (
            currentData.descricao &&
            currentData.descricao !== 'Dia Letivo' &&
            currentData.descricao !== 'Férias' &&
            currentData.descricao !== 'Férias / Recesso Escolar' &&
            parsedCat !== 'normal'
          ) {
            const eventDate = new Date(`${dateStr}T12:00:00`);
            if (eventDate >= today && eventDate <= next30Days) {
              const alreadyHasDbEvent = mergedEvents.some(
                e => e?.data_evento?.toString?.()?.startsWith?.(dateStr)
              );
              if (!alreadyHasDbEvent) {
                mergedEvents.push({
                  id: `cal-${dateStr}`,
                  data_evento: dateStr,
                  titulo: currentData.descricao,
                  descricao: currentData.abreviacao ? `(${currentData.abreviacao})` : '',
                  tipo: parsedCat === 'nao_letivo' ? 'Feriado'
                      : parsedCat === 'exame_final' ? 'Prazo'
                      : parsedCat === 'letivo' ? 'Prazo'
                      : 'Aviso'
                });
              }
            }
          }
        });

        // Ordenar por data e limitar a 4 eventos
        mergedEvents.sort((a, b) =>
          new Date(`${a?.data_evento}T12:00:00`).getTime() - new Date(`${b?.data_evento}T12:00:00`).getTime()
        );
      } catch (calErr) {
        console.error('Erro ao mesclar eventos do calendário:', calErr);
      }

      setEvents(mergedEvents.slice(0, 4));

    } catch (error) {
      console.error('Erro ao buscar dados da landing page:', error);
    } finally {
      setLoading(false);
    }
  };




  return (
    <div className="landing-page">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-inner">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><MapPin size={14} className="text-gold-light" /> R. Elesbão Murtinho, 856 – Campo Grande/MS</span>
            <span className="hidden md:inline">|</span>
            <a href="mailto:eejbr@sed.ms.gov.br" className="flex items-center gap-1"><Mail size={14} /> eejbr@sed.ms.gov.br</a>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="https://www.sed.ms.gov.br" target="_blank" rel="noopener noreferrer">SED/MS</a>
            <a href="#">IDEB 5.1</a>
            <a href="#">Escola de Autoria</a>
          </div>
        </div>
      </div>

      {/* HEADER */}
      <div className="landing-header-main">
        <div className="header-inner">
          <div className="logo-wrap">
            <img 
              src="/logo.png.png" 
              alt="Logo JBR" 
            />
            <div className="school-name flex flex-col justify-center">
              <h1 className="text-xl md:text-2xl font-black m-0" style={{ color: 'var(--sed-blue-dark)' }}>E.E. JOSÉ BARBOSA RODRIGUES</h1>
              <span className="text-sm md:text-base font-bold mt-1" style={{ color: 'var(--gold)' }}>Escola de Autoria – SED/MS</span>
            </div>
          </div>
          <div className="header-right">
            <button onClick={() => onEnterPortal()} className="btn-portal">
              <LogIn size={18} />
              Portal do Servidor
            </button>
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav className="landing-nav-main">
        <div className="nav-inner">
          <div className="nav-item active"><a href="#" className="flex items-center gap-2"><Home size={18} /> Início</a></div>
          
          <div 
            className="nav-item group"
            onMouseEnter={() => setActiveDropdown('escola')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button className="flex items-center gap-2">
              <BookOpen size={18} /> A Escola <ChevronRight size={14} className="rotate-90" />
            </button>
            {activeDropdown === 'escola' && (
              <div className="dropdown">
                <a href="#">Nossa História</a>
                <a href="#identidade">Missão e Valores</a>
                <a href="#">Estrutura Física</a>
                <a href="#">Corpo Diretivo</a>
                <a href="#">Escola de Autoria</a>
              </div>
            )}
          </div>

          <div 
            className="nav-item group"
            onMouseEnter={() => setActiveDropdown('ensino')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button className="flex items-center gap-2">
              <GraduationCap size={18} /> Ensino <ChevronRight size={14} className="rotate-90" />
            </button>
            {activeDropdown === 'ensino' && (
              <div className="dropdown">
                <a href="#">Ensino Médio</a>
                <a href="#">Tempo Integral</a>
                <a href="#">Grade Curricular</a>
                <a href="#">Projetos Pedagógicos</a>
                <a href="#">Avaliações</a>
              </div>
            )}
          </div>

          <div 
            className="nav-item group"
            onMouseEnter={() => setActiveDropdown('docs')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button className="flex items-center gap-2">
              <FileText size={18} /> Documentos <ChevronRight size={14} className="rotate-90" />
            </button>
            {activeDropdown === 'docs' && (
              <div className="dropdown">
                <a href="#">Projeto Político-Pedagógico</a>
                <a href="#">Regimento Escolar</a>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowCalendarModal(true); }}>Calendário Letivo 2026</a>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowCardapioModal(true); }}>Cardápio da Merenda</a>
                <a href="#">Formulários</a>
              </div>
            )}
          </div>

          <div 
            className="nav-item group"
            onMouseEnter={() => setActiveDropdown('comunidade')}
            onMouseLeave={() => setActiveDropdown(null)}
          >
            <button className="flex items-center gap-2">
              <Users size={18} /> Comunidade <ChevronRight size={14} className="rotate-90" />
            </button>
            {activeDropdown === 'comunidade' && (
              <div className="dropdown">
                <a href="#">APM – Associação de Pais</a>
                <a href="#">Grêmio Estudantil</a>
                <a href="#">Conselho Escolar</a>
                <a href="#">Saúde e Bem-Estar</a>
              </div>
            )}
          </div>

          <div className="nav-item">
            <a href="#noticias" className="flex items-center gap-2">
              <Newspaper size={18} /> Notícias
            </a>
          </div>
          <div className="nav-item">
            <a href="#" className="flex items-center gap-2" onClick={(e) => { e.preventDefault(); setShowContatoModal(true); }}>
              <Phone size={18} /> Contato
            </a>
          </div>
          <div className="nav-item">
            <a href="#" className="flex items-center gap-2">
              <Globe size={18} /> Links Úteis
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-pattern"></div>
        <div className="hero-inner">
          <div className="hero-text">
            <h2>Formando cidadãos,<br />construindo <em style={{ color: 'var(--gold)', fontStyle: 'normal' }}>futuros</em></h2>
            <p>
              Fundada em 05 de agosto de 1980, a E.E. José Barbosa Rodrigues é referência de educação pública de qualidade no bairro Universitário, em Campo Grande/MS. Escola de Autoria em Tempo Integral.
            </p>
            <div className="hero-btns">
              <a href="#" className="btn-primary">Conheça Nossa Escola</a>
              <a href="#" className="btn-outline" onClick={(e) => { e.preventDefault(); setShowCalendarModal(true); }}>Calendário Letivo 2026</a>
            </div>
          </div>
          <div className="hero-cards">
            <div className="hero-stat">
              <div className="icon"><Calendar size={32} strokeWidth={1.5} className="text-gold" /></div>
              <div>
                <strong>Agosto 1980</strong>
                <span>Ano de fundação</span>
              </div>
            </div>
            <div className="hero-stat">
              <div className="icon"><GraduationCap size={32} strokeWidth={1.5} className="text-gold" /></div>
              <div>
                <strong>Ensino Fundamental e Médio</strong>
                <span>Tempo Integral – Escola de Autoria</span>
              </div>
            </div>
            <div className="hero-stat">
              <div className="icon"><BarChart3 size={32} strokeWidth={1.5} className="text-gold" /></div>
              <div>
                <strong>IDEB 5.1</strong>
                <span>Anos Finais – Censo 2023</span>
              </div>
            </div>
            <div className="hero-stat">
              <div className="icon"><Trophy size={32} strokeWidth={1.5} className="text-gold" /></div>
              <div>
                <strong>NSE Médio-Alto</strong>
                <span>Nível Socioeconômico – INSE 2021</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACCESS */}
      <section className="quick-bg">
        <div className="section-inner">
          <div className="section-title">Acesso Rápido</div>
          <div className="divider"></div>
          <div className="quick-grid">
            <a className="quick-card" href="#" onClick={(e) => { e.preventDefault(); setShowCalendarModal(true); }}>
              <span className="icon"><Calendar size={32} strokeWidth={1.5} /></span>
              <h4>Calendário Letivo</h4>
              <p>Datas e eventos 2026</p>
            </a>
            <a className="quick-card" href="#" onClick={(e) => { e.preventDefault(); setShowMatriculaModal(true); }}>
              <span className="icon"><FileText size={32} strokeWidth={1.5} /></span>
              <h4>Matrícula</h4>
              <p>Informações e formulários</p>
            </a>
            <a className="quick-card" href="#" onClick={(e) => { e.preventDefault(); setShowCardapioModal(true); }}>
              <span className="icon"><BookOpen size={32} strokeWidth={1.5} /></span>
              <h4>Cardápio Escolar</h4>
              <p>Merenda da semana</p>
            </a>
            <a className="quick-card" href="#" onClick={(e) => { e.preventDefault(); onEnterPortal('aluno'); }}>
              <span className="icon"><Users size={32} strokeWidth={1.5} /></span>
              <h4>Biblioteca</h4>
              <p>BiblioClube JBR</p>
            </a>
            <a className="quick-card" href="#" onClick={(e) => { e.preventDefault(); abrirAgendaDoRecurso('Ciências'); }}>
              <span className="icon"><Layers size={32} strokeWidth={1.5} /></span>
              <h4>Lab. Ciências</h4>
              <p>Reservas e atividades</p>
            </a>
            <a className="quick-card" href="#" onClick={(e) => { e.preventDefault(); abrirAgendaDoRecurso('Informática'); }}>
              <span className="icon"><Globe size={32} strokeWidth={1.5} /></span>
              <h4>Lab. Informática</h4>
              <p>Agendamentos</p>
            </a>
            <a className="quick-card" href="#" onClick={(e) => { e.preventDefault(); abrirAgendaDoRecurso('Quadra'); }}>
              <span className="icon"><Trophy size={32} strokeWidth={1.5} /></span>
              <h4>Quadra Esportiva</h4>
              <p>Horários e reservas</p>
            </a>
            <a className="quick-card" href="#" onClick={(e) => { e.preventDefault(); setShowContatoModal(true); }}>
              <span className="icon"><Phone size={32} strokeWidth={1.5} /></span>
              <h4>Fale com a Escola</h4>
              <p>Canais de atendimento</p>
            </a>
          </div>
        </div>
      </section>

      {/* NEWS */}
      <section id="noticias">
        <div className="section-inner">
          <div className="section-title">Notícias e Eventos</div>
          <div className="divider"></div>
          <div className="news-grid">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="news-card animate-pulse">
                  <div className="news-card-img bg-gray-200"></div>
                  <div className="news-card-body">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                  </div>
                </div>
              ))
            ) : news.length > 0 ? (
              news.map(item => {
                const isInstagram = item.categoria === 'INSTAGRAM';
                
                if (isInstagram) {
                  return (
                    <div key={item.id} className="instagram-card">
                      <a 
                        href={item.conteudo || "https://www.instagram.com/jbrautoria/"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="instagram-card-image block relative overflow-hidden group/img cursor-pointer"
                      >
                        {item.imagem_url ? (
                          <img 
                            src={item.imagem_url} 
                            alt={item.titulo} 
                            className="instagram-image group-hover/img:scale-105 transition-transform duration-500"
                            style={{ width: '100%', height: 'clamp(140px, 40vw, 240px)', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                parent.className = "instagram-card-image flex flex-col justify-center items-center p-8 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white w-full h-[240px]";
                                parent.innerHTML = `
                                  <svg class="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                                `;
                              }
                            }}
                          />
                        ) : (
                          <div className="flex flex-col justify-center items-center p-8 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white w-full" style={{ height: 'clamp(140px, 40vw, 240px)' }}>
                            <svg className="w-12 h-12 mb-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                          </div>
                        )}
                      </a>
                      <div className="instagram-card-body !pt-3 !pb-4 !px-4 flex flex-col justify-between" style={{ minHeight: 'auto' }}>
                        <a href={item.conteudo || "https://www.instagram.com/jbrautoria/"} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
                          <p className="instagram-caption !text-xs !mb-2 line-clamp-3">
                            <strong>jbrautoria</strong> {item.subtitulo || item.titulo}
                          </p>
                        </a>
                        <div className="instagram-date !text-[10px] !mt-1">
                          {new Date(item.data_publicacao).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="news-card">
                    <div className="news-card-img" style={{ 
                      backgroundImage: item.imagem_url ? `url(${item.imagem_url})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: 'var(--sed-blue)'
                    }}>
                      {!item.imagem_url && <BookOpen size={48} strokeWidth={1} className="opacity-50" />}
                      <span className="news-tag">{item.categoria || 'NOTÍCIA'}</span>
                    </div>
                    <div className="news-card-body">
                      <div className="news-date">{new Date(item.data_publicacao).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
                      <h3>{item.titulo}</h3>
                      <p>{item.subtitulo}</p>
                      <a className="news-link" href="#">Leia mais →</a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-3 text-center py-10 text-gray-500">Nenhuma notícia publicada.</div>
            )}
          </div>
        </div>
      </section>

      {/* CALENDAR & WARNINGS */}
      <section id="calendario">
        <div className="section-inner">
          <div className="calendar-warnings-grid">
            <div>
              <div className="section-title">Próximos Eventos</div>
              <div className="divider"></div>
              <div className="calendar-list">
                {loading ? (
                  [1, 2, 3].map(i => <div key={i} className="cal-item animate-pulse h-20 bg-gray-100"></div>)
                ) : events.length > 0 ? (
                  events.map(event => {
                    const date = new Date(`${event.data_evento}T12:00:00`);
                    return (
                      <div key={event.id} className="cal-item" style={{ borderLeftColor: event.tipo === 'Prazo' ? 'var(--crimson)' : event.tipo === 'Aviso' ? 'var(--sed-blue-light)' : 'var(--gold)' }}>
                        <div className="cal-date">
                          <strong>{date.getDate()}</strong>
                          <span>{date.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                        </div>
                        <div className="cal-info">
                          <h4>{event.titulo}</h4>
                          <p>{event.descricao}</p>
                        </div>
                        <span className={`cal-badge ${event.tipo?.toLowerCase() || 'evento'}`}>{event.tipo || 'Evento'}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-500 py-4">Nenhum evento agendado.</div>
                )}
              </div>
            </div>
            <div>
              <div className="section-title">Avisos Importantes</div>
              <div className="divider"></div>
              <div className="flex flex-col gap-4">
                {loading ? (
                  [1, 2].map(i => <div key={i} className="warning-card animate-pulse h-24 bg-gray-100"></div>)
                ) : warnings.length > 0 ? (
                  warnings.map(warning => (
                    <div key={warning.id} className={`warning-card warning-${warning.cor_alerta || 'blue'}`}>
                      <strong>{warning.titulo}</strong>
                      <p>{warning.mensagem}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 py-4">Sem avisos no momento.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="sobre">
        <div className="section-inner">
          <div className="about-grid">
            <div className="about-text">
              <div className="section-title">Sobre Nossa Escola</div>
              <div className="divider"></div>
              <p>
                A <strong>Escola Estadual José Barbosa Rodrigues</strong> foi fundada em 05 de agosto de 1980,
                tendo como patrono o <strong>professor e jornalista José Barbosa Rodrigues</strong>. Localizada
                na Rua Elesbão Murtinho, 856, no Bairro Universitário, em Campo Grande/MS.
              </p>
              <p>
                Desde 2017, a escola integra o programa <strong>Escola de Autoria</strong>, oferecendo Ensino
                Médio em Tempo Integral, com foco no desenvolvimento das competências socioemocionais e protagonismo estudantil.
              </p>
              <p>
                A escola conta com estrutura completa: <strong>biblioteca, laboratórios de ciências e informática, quadra coberta, refeitório, área verde</strong> e equipe dedicada a proporcionar um ambiente inclusivo e acolhedor.
              </p>
              <div className="mt-8">
                <button onClick={(e) => { e.preventDefault(); setShowHistoryModal(true); }} className="btn-primary" style={{ border: 'none', cursor: 'pointer' }}>Saiba mais sobre a história →</button>
              </div>
            </div>
            <div className="about-facts">
              <div className="fact-card" style={{ borderTopColor: 'var(--gold)' }}>
                <strong>1980</strong>
                <span>Ano de fundação</span>
              </div>
              <div className="fact-card" style={{ borderTopColor: 'var(--crimson)' }}>
                <strong>45 anos</strong>
                <span>De história e tradição</span>
              </div>
              <div className="fact-card" style={{ borderTopColor: 'var(--sed-blue-light)' }}>
                <strong>400+</strong>
                <span>Alunos matriculados</span>
              </div>
              <div className="fact-card" style={{ borderTopColor: 'var(--teal)' }}>
                <strong>Integral</strong>
                <span>Escola de Autoria</span>
              </div>
              <div className="fact-card fact-wide" style={{ borderTopColor: 'var(--sed-blue-dark)' }}>
                <strong>Ensino Fundamental e Médio</strong>
                <span>em Tempo Integral – Bairro Universitário, Campo Grande/MS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MISSÃO VISÃO VALORES */}
      <section id="identidade" className="bg-gray-50 py-16">
        <div className="section-inner max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black" style={{ color: 'var(--sed-blue-dark)' }}>Identidade Institucional</h2>
            <div className="w-24 h-1 bg-[#d4af37] mx-auto mt-4"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Missão */}
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                    <Rocket size={28} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-800">Missão</h3>
                </div>
                <p className="text-gray-600 leading-relaxed font-medium text-lg">
                  "Oferecer um Ensino Médio em Tempo Integral de excelência, focado no desenvolvimento completo do estudante. Nosso compromisso é formar jovens autônomos, solidários e competentes, valorizando a diversidade sul-mato-grossense e preparando-os para transformar a sociedade com uma visão de mundo ampla e crítica."
                </p>
              </div>
            </div>

            {/* Visão */}
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-inner">
                    <Globe size={28} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-800">Visão</h3>
                </div>
                <p className="text-gray-600 leading-relaxed font-medium text-lg">
                  "Ser referência nacional em educação de qualidade, reconhecida por nossas práticas pedagógicas inovadoras e gestão transparente e participativa. Buscamos inspirar confiança na comunidade escolar e fortalecer parcerias, consolidando nosso compromisso com o sucesso e a excelência na formação humana e acadêmica."
                </p>
              </div>
            </div>
          </div>

          {/* Valores */}
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100">
            <div className="text-center mb-10">
              <h3 className="text-2xl font-black text-gray-800 mb-2">Nossos Valores</h3>
              <p className="text-gray-500 font-medium">Princípios que guiam nossa atuação educacional</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex-shrink-0 flex items-center justify-center text-purple-600">
                  <Award size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-lg mb-1">Excelência e Dedicação</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">Prestação de serviços educacionais de alta qualidade, valorizando tanto nossos estudantes quanto nossos educadores.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-600">
                  <UserCheck size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-lg mb-1">Respeito e Ética</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">Atuação pautada pela transparência, responsabilidade, probidade e, acima de tudo, pela valorização do ser humano.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex-shrink-0 flex items-center justify-center text-yellow-600">
                  <Lightbulb size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-lg mb-1">Inovação e Protagonismo</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">Estímulo à criatividade, ao empreendedorismo e ao desenvolvimento contínuo para potencializar a qualidade do ensino.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex-shrink-0 flex items-center justify-center text-green-600">
                  <Handshake size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-lg mb-1">Gestão Democrática e Cooperação</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">Incentivo ao trabalho em equipe e à gestão participativa, construindo soluções em conjunto com a comunidade.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-100 flex-shrink-0 flex items-center justify-center text-pink-600">
                  <Heart size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-lg mb-1">Equidade e Inclusão</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">Garantia de acesso, permanência e sucesso para todos os estudantes, respeitando suas singularidades no processo educacional.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex-shrink-0 flex items-center justify-center text-red-600">
                  <Target size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-lg mb-1">Disciplina e Determinação</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">Compreensão e cumprimento das regras coletivas, cultivando o foco e a determinação em toda a comunidade escolar.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HISTÓRIA COMPLETA MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 flex items-start justify-center py-10 px-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-gray-50 max-w-6xl w-full rounded-3xl shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-6 right-6 w-12 h-12 bg-white hover:bg-gray-200 text-gray-800 rounded-full flex items-center justify-center font-bold text-2xl z-50 shadow-md transition-colors"
            >
              ✕
            </button>
            <div className="p-8 md:p-12">
              <div className="text-center mb-12">
                 <h2 className="text-4xl font-black text-[#002f6c] mb-4">Nossa História</h2>
                 <div className="w-24 h-1 bg-[#d4af37] mx-auto"></div>
              </div>

              <div className="grid grid-cols-1 gap-12 items-start mb-16">
                 <div className="space-y-6 text-gray-700 text-lg leading-relaxed bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
                     <p className="text-xl font-medium text-gray-900 border-l-4 border-[#002f6c] pl-4">
                         Fundada em <strong className="text-[#002f6c]">5 de agosto de 1980</strong>, a Escola Estadual José Barbosa Rodrigues é um marco educacional localizado no bairro Universitário, em Campo Grande – MS (Rua Elesbão Murtinho, 856).
                     </p>
                     <p>
                         Nossa jornada escolar teve início oficial poucos dias após a fundação, em 11 de agosto de 1980, quando abrimos as portas para receber nossos primeiros alunos, oriundos de transferência da Escola "Martinho Lutero". Desde então, construímos uma trajetória baseada na união com a comunidade e na busca constante por soluções coletivas para o nosso cotidiano.
                     </p>
                 </div>
                 <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden">
                     <h3 className="text-2xl font-bold text-[#002f6c] mb-6 flex items-center gap-3 relative z-10">
                         <span className="w-10 h-10 rounded-xl bg-[#d4af37] text-white flex items-center justify-center text-lg shadow-lg"><User className="w-5 h-5" /></span>
                         O Patrono: José Barbosa Rodrigues
                     </h3>
                     <div className="flex flex-col md:flex-row gap-8 relative z-10">
                         <div className="w-full md:w-[220px] flex-shrink-0">
                             <div className="bg-gray-100 p-2 rounded-2xl shadow-inner">
                                 <img src="/patrono.png" alt="José Barbosa Rodrigues" className="w-full h-auto rounded-xl shadow-md object-cover md:aspect-[4/3]" />
                             </div>
                         </div>
                         <div className="w-full text-gray-600 text-sm flex flex-col justify-center">
                             <p className="mb-4 text-base">
                                 A escola é uma justa homenagem ao professor e jornalista, escolhido por seu notável zelo e interação com a educação e a cultura sul-mato-grossense.
                             </p>
                             <p className="mb-4">
                                 Nascido em Poços de Caldas (MG) em julho de 1916, chegou a Campo Grande no início da década de 1940. Editou o primeiro jornal da cidade e ocupou a Cadeira nº 13 da Academia de Letras.
                             </p>
                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                 <p className="font-bold text-[#002f6c] mb-2">Obras de destaque:</p>
                                 <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                     <li className="flex items-center gap-1"><span className="text-[#d4af37]">▪</span> Palavra de um professor (1949)</li>
                                     <li className="flex items-center gap-1"><span className="text-[#d4af37]">▪</span> Campo Grande, Meu Amor (1978)</li>
                                     <li className="flex items-center gap-1"><span className="text-[#d4af37]">▪</span> Isto é Mato Grosso do Sul (1978)</li>
                                     <li className="flex items-center gap-1"><span className="text-[#d4af37]">▪</span> História de Campo Grande (1980)</li>
                                     <li className="flex items-center gap-1"><span className="text-[#d4af37]">▪</span> História da Terra MT (1983)</li>
                                     <li className="flex items-center gap-1"><span className="text-[#d4af37]">▪</span> Glossário Mato-grossense (1987)</li>
                                 </ul>
                             </div>
                         </div>
                     </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-12">
                  <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 border-t-4 border-t-[#002f6c]">
                      <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                          <Landmark className="w-8 h-8 text-[#002f6c]" /> Trajetória e Gestão
                      </h3>
                      <p className="text-gray-700 mb-6 text-sm leading-relaxed">
                          A história da nossa escola é marcada pela evolução da sua gestão, cada vez mais participativa. O marco ocorreu na década de 1990, com a transição para a escolha de diretores via voto direto da comunidade escolar e a institucionalização do Colegiado Escolar em 1993.
                      </p>
                      <div className="space-y-2 text-sm text-gray-600 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                          <div className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors"><span className="font-bold text-[#002f6c]">Vera Albertina T. M. Mittelstaedt (1980–1981):</span> Primeira diretora, conduziu a escola desde o seu ato de criação.</div>
                          <div className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors"><span className="font-bold text-[#002f6c]">Nadir Pereira de Oliveira (1981–1983)</span></div>
                          <div className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors"><span className="font-bold text-[#002f6c]">João Martins de Oliveira (1983–1991):</span> Permaneceu no cargo por 8 anos.</div>
                          <div className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors"><span className="font-bold text-[#002f6c]">Jussara Rodrigues de Almeida:</span> 1ª diretora eleita pelo voto direto.</div>
                          <div className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors"><span className="font-bold text-[#002f6c]">Heloísa Helena Caizolaio:</span> Eleita para dois mandatos consecutivos (aposentada em 1998).</div>
                          <div className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors"><span className="font-bold text-[#002f6c]">Vitalina Maria Genout Trentini (1998–2004)</span></div>
                          <div className="p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors"><span className="font-bold text-[#002f6c]">José Carlos dos Santos Brum (2005–2007)</span></div>
                      </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 border-t-4 border-t-blue-500">
                      <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                          <Rocket className="w-8 h-8 text-blue-500" /> A Escola Hoje
                      </h3>
                      <p className="leading-relaxed text-gray-700 mb-4 text-sm md:text-base">
                          Em 2017, demos mais um grande passo ao integrar o programa <strong className="text-[#002f6c]">Escola de Autoria</strong>. Passamos a oferecer o Ensino Médio em Tempo Integral, com foco no desenvolvimento das competências socioemocionais e protagonismo dos estudantes.
                      </p>
                      <p className="leading-relaxed text-gray-700 text-sm md:text-base">
                          Estrutura completa: biblioteca, laboratórios de ciências e informática, quadra coberta, refeitório e área verde, com uma equipe dedicada a um ambiente inclusivo.
                      </p>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 border-t-4 border-t-[#d4af37]">
                      <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                          <Handshake className="w-8 h-8 text-[#d4af37]" /> Gestão Atual
                      </h3>
                      <p className="leading-relaxed text-gray-700 text-sm md:text-base">
                          Hoje, a tradição e o compromisso com o ensino de qualidade continuam sob a liderança da atual equipe gestora: os diretores <strong className="text-[#002f6c]">Edvaldo Lourenço</strong> e <strong className="text-[#002f6c]">Marcio Kazuo Masuda</strong>, trabalhando em parceria com a comunidade para escrever os próximos capítulos da nossa história.
                      </p>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="landing-footer-main">
        <div className="footer-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <img src="/logo.png.png" alt="Logo Footer" />
              <p>E.E. José Barbosa Rodrigues – Escola de Autoria em Tempo Integral. Comprometida com a excelência acadêmica e formação humana.</p>
            </div>
            <div className="footer-col">
              <h4>Navegação</h4>
              <ul>
                <li><a href="#">Início</a></li>
                <li><a href="#">A Escola</a></li>
                <li><a href="#">Ensino</a></li>
                <li><a href="#">Notícias</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Serviços</h4>
              <ul>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setShowCalendarModal(true); }}>Calendário</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setShowMatriculaModal(true); }}>Matrícula</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onEnterPortal(); }}>Portal do Servidor</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); onEnterPortal('aluno'); }}>Biblioteca</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Contato</h4>
              <p className="text-sm text-gray-400 mb-4">(67) 3387-9966</p>
              <p className="text-sm text-gray-400">Rua Elesbão Murtinho, 856<br />Bairro Universitário<br />Campo Grande/MS</p>
            </div>
          </div>
          <div className="text-center mt-6 text-sm text-gray-500">
            &copy; {new Date().getFullYear()} SED/MS. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* MODAL CALENDÁRIO LETIVO 2026 */}
      <CalendarioLetivoModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
      />

      {/* MODAL CARDÁPIO ESCOLAR */}
      <CardapioPublicoModal
        isOpen={showCardapioModal}
        onClose={() => setShowCardapioModal(false)}
      />

      {/* MODAL FALE COM A ESCOLA */}
      <ContatoModal
        isOpen={showContatoModal}
        onClose={() => setShowContatoModal(false)}
      />

      {/* MODAL MATRÍCULA */}
      <MatriculaInfoModal
        isOpen={showMatriculaModal}
        onClose={() => setShowMatriculaModal(false)}
      />

      {/* MODAL "EM BREVE" (Biblioteca — e fallback se algum recurso não for encontrado) */}
      <EmBreveModal
        isOpen={emBreveTitulo !== null}
        titulo={emBreveTitulo ?? ''}
        onClose={() => setEmBreveTitulo(null)}
      />

      {/* AGENDA PÚBLICA DO RECURSO (Lab. Ciências, Lab. Informática, Quadra Esportiva) */}
      <AgendaPublicaModal
        recurso={recursoAgendaAberta}
        onClose={() => {
          setRecursoAgendaAberta(null);
          window.history.replaceState({}, '', '/');
        }}
        onRequireLogin={() => onEnterPortal()}
      />
    </div>
  );
};
