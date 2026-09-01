import { useEffect, useState } from 'react';
import { X, Loader2, CalendarPlus, History } from 'lucide-react';
import { SectionIcon } from '../ui/SectionIcon';
import { useAuth } from '../../hooks/useAuth';
import { PERIODOS_AULA } from '../../data/periodosAula';
import type { Recurso } from '../../types/agendamento';
import type { ReservaComRecurso } from '../../services/agendamentoService';
import {
  listarRecursos,
  listarTurmas,
  listarProfessoresParaSelecao,
  obterMeuProfessorId,
  obterUserIdDoProfessor,
  criarReserva,
  traduzirErroReserva,
  listarReservasRecentesParaRepetir,
} from '../../services/agendamentoService';
import { notifyReservaCriada } from '../../services/pushService';

interface ReservaFormModalProps {
  recursoIdInicial?: string | null;
  onClose: () => void;
  onCriada?: () => void;
}

const PERIODO_PERSONALIZADO = 'PERSONALIZADO';

export function ReservaFormModal({ recursoIdInicial, onClose, onCriada }: ReservaFormModalProps) {
  const { usuarioId, hasAnyRole } = useAuth();
  const podeReservar = hasAnyRole(['PROFESSOR', 'COORDENACAO', 'GESTAO', 'PCPI']);
  const ehStaff = hasAnyRole(['COORDENACAO', 'GESTAO', 'PCPI']);

  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [professores, setProfessores] = useState<{ id: string; nome: string }[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [recursoId, setRecursoId] = useState(recursoIdInicial ?? '');
  const [data, setData] = useState('');
  const [periodo, setPeriodo] = useState(PERIODO_PERSONALIZADO);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [professorId, setProfessorId] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [tema, setTema] = useState('');
  const [objetivos, setObjetivos] = useState('');
  const [recentes, setRecentes] = useState<ReservaComRecurso[]>([]);
  const [mostrarRecentes, setMostrarRecentes] = useState(false);

  useEffect(() => {
    if (!podeReservar) {
      const timeout = setTimeout(() => setCarregandoOpcoes(false), 0);
      return () => clearTimeout(timeout);
    }
    Promise.all([listarRecursos(), listarTurmas(), ehStaff ? listarProfessoresParaSelecao() : Promise.resolve([])])
      .then(([listaRecursos, listaTurmas, listaProfessores]) => {
        setRecursos(listaRecursos);
        setTurmas(listaTurmas);
        setProfessores(listaProfessores);
      })
      .finally(() => setCarregandoOpcoes(false));

    // Aulas recentes: atalho pra repetir uma reserva sem preencher tudo de novo —
    // só faz sentido pra quem reserva pra si mesmo (não staff reservando pra outros).
    if (!ehStaff && usuarioId) {
      obterMeuProfessorId(usuarioId).then((id) => {
        if (id) listarReservasRecentesParaRepetir(id).then(setRecentes);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRepetir(r: ReservaComRecurso) {
    setRecursoId(r.recurso_id);
    setTurmaId(r.turma_id ?? '');
    setFinalidade(r.finalidade ?? '');
    setTema(r.tema ?? '');
    setObjetivos(r.objetivos ?? '');
    setHoraInicio(r.hora_inicio.slice(0, 5));
    setHoraFim(r.hora_fim.slice(0, 5));
    setPeriodo(PERIODO_PERSONALIZADO);
    setMostrarRecentes(false);
  }

  function handlePeriodoChange(valor: string) {
    setPeriodo(valor);
    if (valor === PERIODO_PERSONALIZADO) return;
    const p = PERIODOS_AULA[Number(valor)];
    if (p) {
      setHoraInicio(p.inicio);
      setHoraFim(p.fim);
    }
  }

  async function handleSubmit() {
    setErro(null);
    setSucesso(null);

    if (!recursoId || !data || !horaInicio || !horaFim) {
      setErro('Preencha recurso, data e horário.');
      return;
    }
    if (horaFim <= horaInicio) {
      setErro('O horário final precisa ser depois do inicial.');
      return;
    }

    setEnviando(true);
    try {
      let alvoProfessorId = professorId;
      if (!ehStaff) {
        if (!usuarioId) throw new Error('Sessão inválida.');
        const meuId = await obterMeuProfessorId(usuarioId);
        if (!meuId) throw new Error('Seu usuário não está vinculado a um registro de servidor — fale com a Secretaria.');
        alvoProfessorId = meuId;
      } else if (!alvoProfessorId) {
        throw new Error('Selecione para qual professor é a reserva.');
      }

      const recurso = recursos.find((r) => r.id === recursoId);
      const status = recurso?.requer_aprovacao ? 'PENDENTE' : 'CONFIRMADA';

      await criarReserva({
        recurso_id: recursoId,
        professor_id: alvoProfessorId,
        turma_id: turmaId || null,
        finalidade: finalidade || null,
        data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        status,
        criado_por: usuarioId!,
        tema: tema || null,
        objetivos: objetivos || null,
      });

      // Só notifica quando quem reservou (staff) não é a própria pessoa que vai usar
      // o recurso — evita notificação redundante de "sua própria ação".
      if (ehStaff) {
        const userIdDoAlvo = await obterUserIdDoProfessor(alvoProfessorId);
        if (userIdDoAlvo && userIdDoAlvo !== usuarioId && recurso) {
          notifyReservaCriada({
            professor_user_id: userIdDoAlvo,
            recurso_nome: recurso.nome,
            data,
            hora_inicio: horaInicio,
            pendente: status === 'PENDENTE',
          }).catch(console.error);
        }
      }

      setSucesso(status === 'PENDENTE' ? 'Reserva registrada — aguardando aprovação da Coordenação/Gestão.' : 'Reserva confirmada!');
      onCriada?.();
    } catch (err) {
      setErro(traduzirErroReserva(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-ms-card max-w-lg w-full rounded-2xl shadow-2xl relative my-auto border border-gray-200 dark:border-gray-800">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-9 h-9 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-50 border border-gray-200 dark:border-gray-700"
        >
          <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="px-8 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 bg-gradient-to-r from-ms-blue/5 to-transparent">
          <SectionIcon icon={CalendarPlus} cor="blue" tamanho="md" />
          <h3 className="text-xl font-black text-gray-900 dark:text-ms-main">Nova Reserva</h3>
        </div>

        <div className="p-8 space-y-4">
          {!podeReservar ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Seu perfil não tem permissão para reservar recursos. Se você acredita que isso é um engano, fale com a Coordenação/Gestão.
            </p>
          ) : carregandoOpcoes ? (
            <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blueText" /></div>
          ) : sucesso ? (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-xl text-sm text-green-800 dark:text-green-400 font-medium">{sucesso}</div>
          ) : (
            <>
              {recentes.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setMostrarRecentes(!mostrarRecentes)}
                    className="flex items-center gap-1.5 text-xs font-bold text-ms-blue dark:text-ms-blueText hover:underline"
                  >
                    <History className="w-3.5 h-3.5" /> Repetir uma reserva recente
                  </button>
                  {mostrarRecentes && (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 border border-gray-200 dark:border-gray-800 rounded-xl p-2 bg-gray-50 dark:bg-ms-dark/50">
                      {recentes.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleRepetir(r)}
                          className="w-full text-left px-3 py-2 bg-white dark:bg-ms-dark hover:bg-blue-50 dark:hover:bg-ms-blue/10 rounded-lg text-xs text-gray-800 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-700"
                        >
                          <span className="font-bold text-gray-900 dark:text-ms-main">{r.recurso_nome}</span>
                          {' · '}{r.hora_inicio.slice(0, 5)}–{r.hora_fim.slice(0, 5)}
                          {r.turma_nome ? ` · ${r.turma_nome}` : ''}
                          {r.finalidade ? ` · ${r.finalidade}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Recurso</label>
                <select
                  value={recursoId}
                  onChange={(e) => setRecursoId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm font-medium"
                >
                  <option value="">Selecionar...</option>
                  {recursos.map((r) => <option key={r.id} value={r.id}>{r.nome}{r.em_manutencao ? ' (em manutenção)' : ''}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Data</label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Período</label>
                  <select
                    value={periodo}
                    onChange={(e) => handlePeriodoChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm font-medium"
                  >
                    {PERIODOS_AULA.map((p, idx) => <option key={idx} value={idx}>{p.label} ({p.inicio}-{p.fim})</option>)}
                    <option value={PERIODO_PERSONALIZADO}>Horário personalizado</option>
                  </select>
                </div>
              </div>

              {periodo === PERIODO_PERSONALIZADO && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Início</label>
                    <input
                      type="time"
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Fim</label>
                    <input
                      type="time"
                      value={horaFim}
                      onChange={(e) => setHoraFim(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
                    />
                  </div>
                </div>
              )}

              {ehStaff && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Reservar para (professor)</label>
                  <select
                    value={professorId}
                    onChange={(e) => setProfessorId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm font-medium"
                  >
                    <option value="">Selecionar...</option>
                    {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Turma (opcional)</label>
                <select
                  value={turmaId}
                  onChange={(e) => setTurmaId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
                >
                  <option value="">Nenhuma</option>
                  {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Finalidade (opcional)</label>
                <input
                  type="text"
                  value={finalidade}
                  onChange={(e) => setFinalidade(e.target.value)}
                  placeholder="Ex.: Aula prática de Química"
                  className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Tema (opcional)</label>
                  <input
                    type="text"
                    value={tema}
                    onChange={(e) => setTema(e.target.value)}
                    placeholder="Ex.: Reações de oxirredução"
                    className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Objetivos (opcional)</label>
                  <input
                    type="text"
                    value={objetivos}
                    onChange={(e) => setObjetivos(e.target.value)}
                    placeholder="Ex.: Identificar agentes oxidantes"
                    className="w-full px-4 py-2.5 bg-white dark:bg-ms-dark border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-ms-main outline-none focus:ring-2 focus:ring-ms-blue/20 focus:border-ms-blue text-sm"
                  />
                </div>
              </div>

              {erro && <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-sm text-red-700 dark:text-red-400 font-medium">{erro}</div>}

              <button
                onClick={handleSubmit}
                disabled={enviando}
                className="w-full flex items-center justify-center gap-2 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md shadow-blue-900/20"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Reserva'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
