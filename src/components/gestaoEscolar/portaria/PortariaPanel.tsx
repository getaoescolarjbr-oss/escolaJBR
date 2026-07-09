import { useEffect, useState } from 'react';
import { Loader2, UserPlus, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import type { Visitante, RegistroPortaria } from '../../../types/portaria';
import {
  listarVisitantesPresentes,
  listarVisitantes,
  registrarEntradaVisitante,
  registrarSaidaVisitante,
  listarRegistrosPortaria,
  criarRegistroPortaria,
} from '../../../services/portariaService';

type Aba = 'visitantes' | 'ocorrencias';

// Sub-módulo 4c — dado pessoal de visitante (documento) fica restrito por RLS a
// INSPETOR/GESTAO/SECRETARIA (não é "qualquer servidor" como Almoxarifado/Manutenção)
// — ver create_gestao_portaria.sql. Esta tela só é alcançável por quem já tem esse
// papel (filtro em GestaoEscolarPanel), mas a garantia real é o banco.
export function PortariaPanel() {
  const { usuarioId } = useAuth();
  const [aba, setAba] = useState<Aba>('visitantes');

  const [presentes, setPresentes] = useState<Visitante[]>([]);
  const [historico, setHistorico] = useState<Visitante[]>([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [ocorrencias, setOcorrencias] = useState<RegistroPortaria[]>([]);
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [pessoaAVisitar, setPessoaAVisitar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [tipoOcorrencia, setTipoOcorrencia] = useState('OCORRENCIA_GERAL');
  const [descricaoOcorrencia, setDescricaoOcorrencia] = useState('');
  const [salvandoOcorrencia, setSalvandoOcorrencia] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([listarVisitantesPresentes(), listarRegistrosPortaria()]);
      setPresentes(p);
      setOcorrencias(o);
      if (mostrarHistorico) setHistorico(await listarVisitantes());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerHistorico() {
    setMostrarHistorico(true);
    setHistorico(await listarVisitantes());
  }

  async function handleRegistrarEntrada() {
    if (!nome.trim() || !documento.trim() || !usuarioId) {
      setErro('Informe nome e documento do visitante.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await registrarEntradaVisitante({
        nome: nome.trim(),
        documento: documento.trim(),
        motivo: motivo.trim() || null,
        pessoa_a_visitar: pessoaAVisitar.trim() || null,
        registrado_por: usuarioId,
      });
      setNome('');
      setDocumento('');
      setMotivo('');
      setPessoaAVisitar('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar entrada.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleRegistrarSaida(id: string) {
    await registrarSaidaVisitante(id);
    await carregar();
  }

  async function handleRegistrarOcorrencia() {
    if (!descricaoOcorrencia.trim() || !usuarioId) return;
    setSalvandoOcorrencia(true);
    try {
      await criarRegistroPortaria({ tipo: tipoOcorrencia, descricao: descricaoOcorrencia.trim(), criado_por: usuarioId });
      setDescricaoOcorrencia('');
      await carregar();
    } finally {
      setSalvandoOcorrencia(false);
    }
  }

  const abas: { id: Aba; label: string }[] = [
    { id: 'visitantes', label: 'Visitantes' },
    { id: 'ocorrencias', label: 'Ocorrências' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap gap-2">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${aba === a.id ? 'bg-ms-blue text-white' : 'bg-ms-card text-gray-400 border border-gray-800'}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'visitantes' && (
        <div className="space-y-6">
          <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Registrar entrada</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Nome do visitante" value={nome} onChange={(e) => setNome(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
              <input placeholder="Documento (RG/CPF)" value={documento} onChange={(e) => setDocumento(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
              <input placeholder="Motivo da visita" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
              <input placeholder="Quem vai visitar" value={pessoaAVisitar} onChange={(e) => setPessoaAVisitar(e.target.value)} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            </div>
            {erro && <p className="text-xs text-red-400">{erro}</p>}
            <button onClick={handleRegistrarEntrada} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Registrar entrada
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main">Presentes agora ({presentes.length})</p>
            {loading ? (
              <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
            ) : presentes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum visitante na escola no momento.</p>
            ) : (
              presentes.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-ms-main">{v.nome}</p>
                    <p className="text-[10px] text-gray-500">
                      doc.: {v.documento} · entrou às {new Date(v.entrada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {v.pessoa_a_visitar && ` · visita: ${v.pessoa_a_visitar}`}
                    </p>
                  </div>
                  <button onClick={() => handleRegistrarSaida(v.id)} className="flex items-center gap-1 px-3 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-[11px] text-gray-300 hover:border-ms-blue transition-colors">
                    <LogOut className="w-3 h-3" /> Registrar saída
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            {!mostrarHistorico ? (
              <button onClick={handleVerHistorico} className="text-xs text-gray-400 hover:text-ms-main underline">Ver histórico completo</button>
            ) : (
              <>
                <p className="text-xs font-black uppercase tracking-wider text-ms-main">Histórico</p>
                {historico.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-4 py-2 bg-ms-dark border border-gray-800 rounded-xl text-xs">
                    <span className="text-gray-300">{v.nome} <span className="text-gray-500">({v.documento})</span></span>
                    <span className="text-gray-500">
                      {new Date(v.entrada_em).toLocaleString('pt-BR')} {v.saida_em ? `→ ${new Date(v.saida_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '(ainda presente)'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {aba === 'ocorrencias' && (
        <div className="space-y-6">
          <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Registrar ocorrência de portaria</p>
            <input placeholder="Tipo (ex.: OCORRENCIA_GERAL, ENTREGA, VISITANTE_RECUSADO...)" value={tipoOcorrencia} onChange={(e) => setTipoOcorrencia(e.target.value)} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
            <textarea placeholder="Descrição" value={descricaoOcorrencia} onChange={(e) => setDescricaoOcorrencia(e.target.value)} rows={3} className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue resize-none" />
            <button onClick={handleRegistrarOcorrencia} disabled={salvandoOcorrencia} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
              {salvandoOcorrencia ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
              Registrar
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-ms-main">Ocorrências registradas</p>
            {ocorrencias.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma ocorrência registrada.</p>
            ) : (
              ocorrencias.map((o) => (
                <div key={o.id} className="px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
                  <p className="text-sm font-bold text-ms-main">{o.tipo}</p>
                  <p className="text-xs text-gray-400">{o.descricao}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{new Date(o.criado_em).toLocaleString('pt-BR')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
