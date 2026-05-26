const fs = require('fs');
const file = 'src/components/LandingPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `  React.useEffect(() => {
    fetchLandingData();
    syncInstagramFeed();
  }, []);`;

const replacement1 = `  React.useEffect(() => {
    fetchLandingData();
  }, []);`;

const target2 = `  const fetchLandingData = async () => {
    try {
      setLoading(true);
      const [newsRes, eventsRes, warningsRes] = await Promise.all([
        supabase.from('landing_noticias').select('*').order('data_publicacao', { ascending: false }).limit(6),
        supabase.from('landing_eventos').select('*').order('data_evento', { ascending: true }).limit(4),
        supabase.from('landing_avisos').select('*').neq('cor_alerta', 'config').order('created_at', { ascending: false }).limit(3)
      ]);

      if (newsRes.data) setNews(newsRes.data);`;

const replacement2 = `  const fetchLandingData = async () => {
    try {
      setLoading(true);
      const [newsRes, eventsRes, warningsRes, instaPosts] = await Promise.all([
        supabase.from('landing_noticias').select('*').order('data_publicacao', { ascending: false }).limit(6),
        supabase.from('landing_eventos').select('*').order('data_evento', { ascending: true }).limit(4),
        supabase.from('landing_avisos').select('*').neq('cor_alerta', 'config').order('created_at', { ascending: false }).limit(3),
        fetchInstagramPosts()
      ]);

      let allNews = [];
      if (newsRes.data) allNews = [...newsRes.data];
      if (instaPosts && instaPosts.length > 0) {
        allNews = [...allNews, ...instaPosts];
        // Sort by date descending and limit to 6
        allNews.sort((a, b) => new Date(b.data_publicacao).getTime() - new Date(a.data_publicacao).getTime());
        allNews = allNews.slice(0, 6);
      }
      setNews(allNews);`;

const newFunc = `  const fetchInstagramPosts = async () => {
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
          const cleanCaption = caption.replace(/#\\w+/g, '').trim();
          const firstLine = cleanCaption.split('\\n')[0].trim();
          if (firstLine) titulo = firstLine.length > 65 ? firstLine.slice(0, 62) + '...' : firstLine;
        }
        let dataPublicacao = new Date().toISOString();
        if (post.timestamp || post.created_at || post.date) {
          try { dataPublicacao = new Date(post.timestamp || post.created_at || post.date).toISOString(); } catch (dErr) { }
        }
        mappedPosts.push({
          id: \`insta-\${post.id || permalink}\`, titulo,
          subtitulo: caption.length > 300 ? caption.slice(0, 297) + '...' : caption,
          conteudo: permalink, imagem_url: post.mediaUrl || post.media_url || '',
          categoria: 'INSTAGRAM', data_publicacao: dataPublicacao
        });
      }
      return mappedPosts;
    } catch (err) {
      return [];
    }
  };

`;

content = content.replace(target1.replace(/\r\n/g, '\n'), replacement1);
content = content.replace(target1.replace(/\n/g, '\r\n'), replacement1);

// We need to carefully replace syncInstagramFeed with fetchInstagramPosts
// Since it's large, we'll just insert fetchInstagramPosts above fetchLandingData
content = content.replace('  const fetchLandingData = async () => {', newFunc + '  const fetchLandingData = async () => {');

content = content.replace(target2.replace(/\r\n/g, '\n'), replacement2);
content = content.replace(target2.replace(/\n/g, '\r\n'), replacement2);

fs.writeFileSync(file, content);
console.log('Fixed LandingPage.tsx');
