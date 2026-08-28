import { useEffect, useState } from 'react';
import { Loader2, Plus, Send, Trash2, Megaphone } from 'lucide-react';
import { SectionIcon } from '../../ui/SectionIcon';
import { useAuth } from '../../../hooks/useAuth';
import type { Comunicado, TipoComunicado, DestinoComunicado, SegmentoMembro, OrgaoColegiado } from '../../../types/governanca';
import {
  listarComunicados,
  criarComunicadoRascunho,
  publicarComunicado,
  excluirComunicado,
  criarEventoCalendario,
  listarOrgaos,
} from '../../../services/governancaService';
import { listarTurmas } from '../../../services/agendamentoService';

const ROTULOS_TIPO: Record<TipoComunicado, string> = {
  COMUNICADO: 'Comunicado',
  CONVOCACAO: 'Convocação',
  EVENTO: 'Evento',
};

const ROTULOS_DESTINO: Record<DestinoComunicado, string> = {
  TODOS: 'Todos',
  SEGMENTO: 'Segmento',
  TURMA: 'Turma',
  ORGAO: 'Órgão colegiado',
};

const ROTULOS_SEGMENTO: Record<SegmentoMembro, string> = {
  DOCENTE: 'Docentes', ESPECIALISTA: 'Especialistas (Coordenação)', FUNCIONARIO: 'Funcionários', PAIS: 'Pais/Responsáveis', ALUNO: 'Alunos',
};

export function ComunicadosTab() {
  const { usuarioId } = useAuth();
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [orgaos, setOrgaos] = useState<OrgaoColegiado[]>([]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [publicando, setPublicando] = useState<string | null>(null);

  const [novo, setNovo] = useState({
    tipo: 'COMUNICADO' as TipoComunicado,
    titulo: '',
    corpo: '',
    destino: 'TODOS' as DestinoComunicado,
    destino_ref: '',
    data_evento: new Date().toISOString().slice(0, 10),
  });

  async function carregar() {
    setLoading(true);
    try {
      const [listaComunicados, listaOrgaos, listaTurmas] = await Promise.all([listarComunicados(), listarOrgaos(), listarTurmas()]);
      setComunicados(listaComunicados);
      setOrgaos(listaOrgaos);
      setTurmas(listaTurmas);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  async function handleCriarRascunho() {
    if (!novo.titulo || !usuarioId) {
      setErro('Informe o título.');
      return;
    }
    if (novo.destino !== 'TODOS' && !novo.destino_ref) {
      setErro('Selecione o destino específico.');
      return;
    }
    setErro(null);
    try {
      await criarComunicadoRascunho({
        tipo: novo.tipo,
        titulo: novo.titulo,
        corpo: novo.corpo || null,
        destino: novo.destino,
        destino_ref: novo.destino === 'TODOS' ? null : novo.destino_ref,
        autor_id: usuarioId,
      });
      if (novo.tipo === 'EVENTO') {
        await criarEventoCalendario(novo.data_evento, novo.titulo, 'Governança');
      }
      setNovo({ tipo: 'COMUNICADO', titulo: '', corpo: '', destino: 'TODOS', destino_ref: '', data_evento: new Date().toISOString().slice(0, 10) });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar comunicado.');
    }
  }

  async function handlePublicar(c: Comunicado) {
    setPublicando(c.id);
    setErro(null);
    try {
      await publicarComunicado(c);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao publicar comunicado.');
    } finally {
      setPublicando(null);
    }
  }

  async function handleExcluir(id: string) {
    await excluirComunicado(id);
    await carregar();
  }

  function descricaoDestino(c: Comunicado): string {
    if (c.destino === 'TODOS') return 'Todos';
    if (c.destino === 'SEGMENTO') return ROTULOS_SEGMENTO[c.destino_ref as SegmentoMembro] ?? c.destino_ref ?? '';
    if (c.destino === 'TURMA') return turmas.find((t) => t.id === c.destino_ref)?.nome ?? 'Turma';
    if (c.destino === 'ORGAO') return orgaos.find((o) => o.id === c.destino_ref)?.nome ?? 'Órgão';
    return '';
  }

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-xs text-gray-500">
        A entrega usa a mesma infraestrutura de notificação já usada pelo app (Biblioteca/Agendamento/Ocorrências) —
        não há um segundo sistema de aviso.
      </p>

      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-2"><SectionIcon icon={Megaphone} cor="purple" /> Novo comunicado</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoComunicado })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          <input placeholder="Título" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>
        <textarea placeholder="Corpo da mensagem" value={novo.corpo} onChange={(e) => setNovo({ ...novo, corpo: e.target.value })} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue h-24" />

        {novo.tipo === 'EVENTO' && (
          <input type="date" value={novo.data_evento} onChange={(e) => setNovo({ ...novo, data_evento: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select value={novo.destino} onChange={(e) => setNovo({ ...novo, destino: e.target.value as DestinoComunicado, destino_ref: '' })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
            {Object.entries(ROTULOS_DESTINO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>

          {novo.destino === 'SEGMENTO' && (
            <select value={novo.destino_ref} onChange={(e) => setNovo({ ...novo, destino_ref: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
              <option value="">Segmento...</option>
              {Object.entries(ROTULOS_SEGMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          )}
          {novo.destino === 'TURMA' && (
            <select value={novo.destino_ref} onChange={(e) => setNovo({ ...novo, destino_ref: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
              <option value="">Turma...</option>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          {novo.destino === 'ORGAO' && (
            <select value={novo.destino_ref} onChange={(e) => setNovo({ ...novo, destino_ref: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue">
              <option value="">Órgão...</option>
              {orgaos.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          )}
        </div>

        <button onClick={handleCriarRascunho} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Salvar rascunho
        </button>
      </div>

      <div className="space-y-2">
        {comunicados.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum comunicado cadastrado.</p>
        ) : (
          comunicados.map((c) => (
            <div key={c.id} className="px-4 py-3 bg-ms-card border border-gray-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-bold text-ms-main">
                    {c.titulo}
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase font-black">{ROTULOS_TIPO[c.tipo]}</span>
                  </p>
                  <p className="text-[11px] text-gray-500">Destino: {descricaoDestino(c)}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-black border ${c.status === 'PUBLICADO' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                  {c.status === 'PUBLICADO' ? 'Publicado' : 'Rascunho'}
                </span>
              </div>
              {c.corpo && <p className="text-xs text-gray-400">{c.corpo}</p>}
              {c.status === 'RASCUNHO' && (
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePublicar(c)} disabled={publicando === c.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50">
                    {publicando === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Publicar e notificar
                  </button>
                  <button onClick={() => handleExcluir(c.id)} className="p-1.5 hover:bg-red-500/20 text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
