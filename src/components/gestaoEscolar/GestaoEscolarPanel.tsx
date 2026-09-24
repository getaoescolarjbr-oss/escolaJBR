import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, CircleSlash, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { IndicadoresGestaoEscolar, IndicadorNumerico } from '../../types/gestaoEscolar';
import { temDados } from '../../types/gestaoEscolar';
import { obterIndicadoresGestaoEscolar } from '../../services/gestaoEscolarService';
import { AlmoxarifadoPanel } from './almoxarifado/AlmoxarifadoPanel';
import { ManutencaoPanel } from './manutencao/ManutencaoPanel';
import { PortariaPanel } from './portaria/PortariaPanel';
import { PatrimonioPanel } from './patrimonio/PatrimonioPanel';
import { RHPanel } from './rh/RHPanel';
import { GovernancaPanel } from './governanca/GovernancaPanel';
import { DocumentosInstitucionaisPanel } from './documentos/DocumentosInstitucionaisPanel';
import { OcorrenciasIndicador } from './indicadores/OcorrenciasIndicador';
import { OcorrenciasModal } from './indicadores/OcorrenciasModal';
import { AlunosStatusModal } from './indicadores/AlunosStatusModal';
import { AtestadosModal } from './indicadores/AtestadosModal';
import { AtestadosTile } from './indicadores/AtestadosTile';
import { DiasLetivosCard } from './indicadores/DiasLetivosCard';
import { AprovacaoCard } from './indicadores/AprovacaoCard';

// Fase 1: painel de indicadores, só leitura, só GESTAO. Uma RPC só
// (rpc_indicadores_gestao_escolar) devolve tudo; cada card só mostra número que tem
// fonte de dado real no banco — o que não tem vem como "sem dados ainda", nunca um
// número inventado (ver create_gestao_escolar_fase1.sql).

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

interface IndicadorTileProps {
  label: string;
  valor: IndicadorNumerico;
  // "atencao" pinta o número de âmbar quando > 0 — reservado para contagens que
  // representam algo pendente de ação humana (fila, denúncia, vencimento).
  tom?: 'atencao';
  // Com onClick, o card vira botão (abre o pop-up do indicador).
  onClick?: () => void;
}

function IndicadorTile({ label, valor, tom, onClick }: IndicadorTileProps) {
  if (!temDados(valor)) {
    return (
      <div className="bg-ms-dark border border-dashed border-gray-700 rounded-2xl p-3 flex flex-col gap-1.5">
        <p className="text-[11px] uppercase tracking-wider text-[#2563eb] font-bold">{label}</p>
        <p className="flex items-center gap-1.5 text-sm text-gray-600">
          <CircleSlash className="w-3.5 h-3.5" /> Sem dados ainda
        </p>
        <p className="text-[10px] text-gray-600">{valor.motivo}</p>
      </div>
    );
  }

  const emAtencao = tom === 'atencao' && valor > 0;

  const conteudo = (
    <>
      <p className="text-[11px] uppercase tracking-wider text-[#2563eb] font-bold">{label}</p>
      <p className={`text-3xl font-black flex items-center gap-2 ${emAtencao ? 'text-amber-400' : 'text-ms-main'}`}>
        {emAtencao && <AlertTriangle className="w-5 h-5" />}
        {formatarValor(valor)}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="text-left bg-ms-card border border-gray-800 rounded-2xl p-3 flex flex-col gap-1 hover:border-ms-blueText transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue">
        {conteudo}
      </button>
    );
  }
  return <div className="bg-ms-card border border-gray-800 rounded-2xl p-3 flex flex-col gap-1">{conteudo}</div>;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">{titulo}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{children}</div>
    </section>
  );
}

function BreakdownTile({ label, contagens, onSelecionar }: { label: string; contagens: Record<string, number>; onSelecionar?: (chave: string) => void }) {
  const entradas = Object.entries(contagens);
  return (
    <div className="bg-ms-card border border-gray-800 rounded-2xl p-3 flex flex-col gap-1.5">
      <p className="text-[11px] uppercase tracking-wider text-[#2563eb] font-bold">{label}</p>
      {entradas.length === 0 ? (
        <p className="text-sm text-gray-600">Nenhum registro.</p>
      ) : (
        <div className="space-y-1">
          {entradas.map(([chave, valor]) => {
            const linha = (
              <>
                <span className="text-[#2563eb]">{chave}</span>
                <span className="font-bold text-ms-main">{formatarValor(valor)}</span>
              </>
            );
            return onSelecionar ? (
              <button key={chave} onClick={() => onSelecionar(chave)} className="w-full flex items-center justify-between text-sm rounded px-1 -mx-1 hover:bg-gray-700/30">
                {linha}
              </button>
            ) : (
              <div key={chave} className="flex items-center justify-between text-sm">{linha}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IndicadoresTab() {
  const [dados, setDados] = useState<IndicadoresGestaoEscolar | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [popup, setPopup] = useState<
    { tipo: 'ocorrencias'; filtro: 'sem_visto' } | { tipo: 'atestados' } | { tipo: 'alunos'; status: string } | null
  >(null);
  // Incrementa quando um pop-up altera dados, para o gráfico de ocorrências recarregar já.
  const [versaoOcorrencias, setVersaoOcorrencias] = useState(0);
  const [versaoAtestados, setVersaoAtestados] = useState(0);

  // silencioso = atualiza os números sem trocar a tela por spinner (não fecha pop-ups abertos).
  async function carregar(silencioso = false) {
    if (!silencioso) setLoading(true);
    setErro(null);
    try {
      setDados(await obterIndicadoresGestaoEscolar());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar indicadores.');
    } finally {
      setLoading(false);
    }
  }

  function aoAlterarDados() {
    setVersaoOcorrencias((v) => v + 1);
    void carregar(true);
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
  }, []);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" /></div>;
  }

  if (erro || !dados) {
    return <p className="text-sm text-red-400">{erro ?? 'Não foi possível carregar os indicadores.'}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Atualizado em {new Date(dados.gerado_em).toLocaleString('pt-BR')}</p>
        <button onClick={() => carregar()} className="flex items-center gap-1.5 px-3 py-1.5 bg-ms-card border border-gray-800 rounded-lg text-xs text-gray-400 hover:text-ms-main hover:border-ms-blueText transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      <Secao titulo="Acadêmico">
        <BreakdownTile label="Alunos por status" contagens={dados.academico.alunos_por_status} onSelecionar={(status) => setPopup({ tipo: 'alunos', status })} />
        <OcorrenciasIndicador versao={versaoOcorrencias} onAlterado={() => void carregar(true)} />
        <IndicadorTile label="Ocorrências sem visto do coordenador" valor={dados.academico.ocorrencias_30_dias.sem_visto_coordenador} tom="atencao" onClick={() => setPopup({ tipo: 'ocorrencias', filtro: 'sem_visto' })} />
        <AtestadosTile ativos={dados.academico.servidores_atestado_ativo} versao={versaoAtestados} onAbrir={() => setPopup({ tipo: 'atestados' })} />
        <IndicadorTile label="Alunos infrequentes (candidatos a busca ativa)" valor={dados.academico.infrequencia_alunos} tom="atencao" />
        <DiasLetivosCard />
        <AprovacaoCard />
      </Secao>

      {popup?.tipo === 'ocorrencias' && <OcorrenciasModal filtroInicial={popup.filtro} onClose={() => setPopup(null)} onAlterado={aoAlterarDados} />}
      {popup?.tipo === 'alunos' && <AlunosStatusModal status={popup.status} onClose={() => setPopup(null)} onAlterado={aoAlterarDados} />}
      {popup?.tipo === 'atestados' && <AtestadosModal onClose={() => { setPopup(null); setVersaoAtestados((v) => v + 1); void carregar(true); }} />}

      <Secao titulo="Secretaria">
        <IndicadorTile label="Documentos emitidos (30 dias)" valor={dados.secretaria.documentos_emitidos_30_dias} />
        <BreakdownTile label="Protocolos por status" contagens={dados.secretaria.protocolos_por_status} />
        <IndicadorTile label="Divergências matrícula × operacional" valor={dados.secretaria.divergencias_matricula.total} tom="atencao" />
      </Secao>
      {dados.secretaria.divergencias_matricula.matriculas_registradas === 0 && (
        <p className="-mt-3 text-[11px] text-gray-600">
          Nenhuma matrícula formal registrada ainda no ano corrente — o indicador de divergências não é conclusivo até a Secretaria começar a usar essa tela.
        </p>
      )}

      <Secao titulo="Biblioteca">
        <IndicadorTile label="Empréstimos ativos" valor={dados.biblioteca.emprestimos_ativos} />
        <IndicadorTile label="Alunos cadastrados no BiblioClube" valor={dados.biblioteca.alunos_biblioclube} />
        <IndicadorTile label="Denúncias abertas" valor={dados.biblioteca.denuncias_abertas} tom="atencao" />
        <IndicadorTile label="Resenhas ocultadas aguardando revisão" valor={dados.biblioteca.resenhas_ocultas_revisao} tom="atencao" />
        <IndicadorTile label="Resgates pendentes de retirada" valor={dados.biblioteca.resgates_pendentes} />
      </Secao>

      <Secao titulo="Operacional (Cozinha + Agendamento)">
        <IndicadorTile label="Lotes de estoque vencendo em 7 dias" valor={dados.operacional.lotes_vencendo_7_dias} tom="atencao" />
        <IndicadorTile label="Refeições servidas (30 dias)" valor={dados.operacional.refeicoes_servidas_30_dias} />
        <IndicadorTile label="Reservas de recurso pendentes" valor={dados.operacional.reservas_pendentes} tom="atencao" />
      </Secao>

      <Secao titulo="Almoxarifado">
        <IndicadorTile label="Materiais no mínimo ou abaixo" valor={dados.almoxarifado.materiais_abaixo_minimo} tom="atencao" />
      </Secao>

      <Secao titulo="Manutenção Predial">
        <IndicadorTile label="Chamados abertos/em andamento" valor={dados.manutencao.chamados_abertos} tom="atencao" />
        <IndicadorTile label="Chamados atrasados" valor={dados.manutencao.chamados_atrasados} />
      </Secao>

      <Secao titulo="Portaria">
        <IndicadorTile label="Visitantes presentes agora" valor={dados.portaria.visitantes_presentes} />
      </Secao>

      <Secao titulo="Patrimônio">
        <IndicadorTile label="Bens em manutenção" valor={dados.patrimonio.bens_em_manutencao} tom="atencao" />
      </Secao>

      <Secao titulo="RH">
        <BreakdownTile label="Frequência de servidores hoje" contagens={dados.rh.frequencia_servidores_hoje} />
        <IndicadorTile label="Substituições pendentes (hoje, sem cobertura)" valor={dados.rh.substituicoes_pendentes} tom="atencao" />
      </Secao>

      <Secao titulo="Financeiro">
        <IndicadorTile label="PDDE / APM / prestações de contas" valor={dados.financeiro} />
      </Secao>
    </div>
  );
}

type Aba = 'indicadores' | 'almoxarifado' | 'manutencao' | 'portaria' | 'patrimonio' | 'rh' | 'governanca' | 'documentos';

// A partir desta fase, o módulo Gestão Escolar passa a abrigar sub-módulos
// administrativos (Almoxarifado, e futuramente Manutenção Predial e Portaria/
// Visitantes), cada um com seu próprio recorte de papéis — por isso o módulo em si
// (moduleNav.ts) precisou abrir pra mais papéis além de GESTAO, e esta tela virou um
// switcher de abas em vez de só o painel de indicadores.
export function GestaoEscolarPanel() {
  const { hasRole, hasAnyRole } = useAuth();
  const [aba, setAba] = useState<Aba>(hasRole('GESTAO') ? 'indicadores' : 'almoxarifado');

  // Portaria é mais restrita que Almoxarifado/Manutenção (LGPD: documento de
  // visitante) — INSPETOR/GESTAO/SECRETARIA só, não "qualquer servidor".
  const abas: { id: Aba; label: string; roles?: Parameters<typeof hasAnyRole>[0] }[] = [
    { id: 'indicadores', label: 'Indicadores', roles: ['GESTAO'] },
    { id: 'almoxarifado', label: 'Almoxarifado' },
    { id: 'manutencao', label: 'Manutenção Predial' },
    { id: 'patrimonio', label: 'Patrimônio' },
    { id: 'portaria', label: 'Portaria/Visitantes', roles: ['INSPETOR', 'GESTAO', 'SECRETARIA'] },
    { id: 'rh', label: 'RH', roles: ['GESTAO', 'SECRETARIA'] },
    { id: 'governanca', label: 'Governança', roles: ['GESTAO', 'COORDENACAO', 'SECRETARIA'] },
    { id: 'documentos', label: 'Documentos Institucionais', roles: ['GESTAO', 'COORDENACAO'] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {abas
          .filter((a) => !a.roles || hasAnyRole(a.roles))
          .map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              aria-current={aba === a.id ? 'page' : undefined}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-blue ${
                aba === a.id ? 'bg-ms-blue text-white shadow-lg shadow-blue-900/30' : 'bg-ms-card text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              {a.label}
            </button>
          ))}
      </div>

      {aba === 'indicadores' && hasRole('GESTAO') && <IndicadoresTab />}
      {aba === 'almoxarifado' && <AlmoxarifadoPanel />}
      {aba === 'manutencao' && <ManutencaoPanel />}
      {aba === 'patrimonio' && <PatrimonioPanel />}
      {aba === 'portaria' && hasAnyRole(['INSPETOR', 'GESTAO', 'SECRETARIA']) && <PortariaPanel />}
      {aba === 'rh' && hasAnyRole(['GESTAO', 'SECRETARIA']) && <RHPanel />}
      {aba === 'governanca' && hasAnyRole(['GESTAO', 'COORDENACAO', 'SECRETARIA']) && <GovernancaPanel />}
      {aba === 'documentos' && hasAnyRole(['GESTAO', 'COORDENACAO']) && <DocumentosInstitucionaisPanel />}
    </div>
  );
}
