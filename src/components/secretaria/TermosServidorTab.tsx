import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Printer, Save, Search, X, Plus } from 'lucide-react';
import {
  listarServidores,
  obterDadosServidor,
  obterMatriculaServidor,
  salvarDadosServidor,
  salvarMatriculaServidor,
  type ServidorLista,
} from '../../services/termosServidorService';
import { FUNDAMENTO_VALOR_PADRAO, gerarHtmlTermoConvocado, type DadosTermoConvocado } from '../../utils/termoConvocado';
import { formatarCpf, formatarTelefone } from '../../utils/cadastroServidor';
import { DocumentosServidor } from './DocumentosServidor';

const CHAVE_PREFS = 'termo-convocado-prefs';
const hoje = () => new Date().toISOString().slice(0, 10);

const VAZIO: DadosTermoConvocado = {
  nome: '', rg: '', cpf: '', dataNascimento: '', tituloEleitor: '', zonaEleitoral: '', secaoEleitoral: '',
  endereco: '', telefoneFixo: '', celular: '', email: '', formacao: '',
  horasSemanais: '', componente: '', escolaMunicipio: 'E.E. José Barbosa Rodrigues', periodoDe: '', periodoAte: '',
  substituidoNome: '', substituidoMatricula: '', valorHora: '43,32777', fundamentoValor: FUNDAMENTO_VALOR_PADRAO,
  cidade: '', dataDocumento: hoje(),
};

// Lembra o que raramente muda entre um termo e outro (valor da hora-aula, cidade, escola).
function lerPrefs(): Partial<DadosTermoConvocado> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_PREFS) ?? '{}');
  } catch {
    return {};
  }
}
function gravarPrefs(d: DadosTermoConvocado) {
  try {
    localStorage.setItem(CHAVE_PREFS, JSON.stringify({ valorHora: d.valorHora, fundamentoValor: d.fundamentoValor, cidade: d.cidade, escolaMunicipio: d.escolaMunicipio }));
  } catch { /* sem armazenamento: só não lembra */ }
}

const classeInput = 'w-full px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue';
const classeFalta = 'border-amber-500/60';

function Campo({ rotulo, children, vazio }: { rotulo: string; children: React.ReactNode; vazio?: boolean }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
        {rotulo}
        {vazio && <span className="text-amber-400 normal-case font-bold tracking-normal">em branco</span>}
      </span>
      {children}
    </label>
  );
}

function SeletorServidor({ servidores, valor, onEscolher, onLimpar, placeholder }: {
  servidores: ServidorLista[];
  valor: ServidorLista | null;
  onEscolher: (s: ServidorLista) => void;
  onLimpar: () => void;
  placeholder: string;
}) {
  const [busca, setBusca] = useState('');
  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t.length < 1 ? [] : servidores.filter((s) => s.nome.toLowerCase().includes(t)).slice(0, 8);
  }, [busca, servidores]);

  if (valor) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-ms-blue/10 border border-ms-blueText/20 rounded-lg">
        <span className="text-sm font-bold text-ms-main">{valor.nome} <span className="text-[10px] font-normal text-gray-400">{valor.cargo}</span></span>
        <button type="button" onClick={() => { onLimpar(); setBusca(''); }} className="text-gray-400 hover:text-gray-200" aria-label="Trocar"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholder} className={`${classeInput} pl-9`} />
      {resultados.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-ms-card border border-gray-800 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {resultados.map((s) => (
            <button key={s.id} type="button" onClick={() => { onEscolher(s); setBusca(''); }} className="w-full text-left px-4 py-2 text-sm text-ms-main hover:bg-ms-blue/20">
              {s.nome} <span className="text-[10px] text-gray-500">{s.cargo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Termo de Ajuste e Compromisso — Professor Convocado. Escolhe o servidor na lista do
// banco, completa o que faltar (fica salvo no cadastro para a próxima vez) e imprime o
// termo em A4, frente e verso, igual ao formulário em papel.
export function TermosServidorTab() {
  const [servidores, setServidores] = useState<ServidorLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [servidor, setServidor] = useState<ServidorLista | null>(null);
  const [substituido, setSubstituido] = useState<ServidorLista | null>(null);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [dados, setDados] = useState<DadosTermoConvocado>(() => ({ ...VAZIO, ...lerPrefs() }));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setServidores(await listarServidores());
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar servidores.');
      } finally {
        setCarregando(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const set = <K extends keyof DadosTermoConvocado>(campo: K, valor: DadosTermoConvocado[K]) => {
    setMsg(null);
    setDados((d) => ({ ...d, [campo]: valor }));
  };

  async function escolherServidor(s: ServidorLista) {
    setServidor(s);
    setErro(null);
    try {
      const x = await obterDadosServidor(s);
      setDisciplinas(x.disciplinas);
      setDados((d) => ({
        ...d,
        nome: x.nome, email: x.email, cpf: formatarCpf(x.cpf), dataNascimento: x.dataNascimento,
        celular: formatarTelefone(x.telefone), rg: x.rg, tituloEleitor: x.tituloEleitor, zonaEleitoral: x.zonaEleitoral,
        secaoEleitoral: x.secaoEleitoral, endereco: x.endereco, telefoneFixo: x.telefoneFixo, formacao: x.formacao,
      }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados do servidor.');
    }
  }

  async function escolherSubstituido(s: ServidorLista) {
    setSubstituido(s);
    let matricula = '';
    try {
      if (s.pessoa_id) matricula = await obterMatriculaServidor(s.pessoa_id);
    } catch { /* matrícula digitada à mão */ }
    setDados((d) => ({ ...d, substituidoNome: s.nome, substituidoMatricula: matricula }));
  }

  function adicionarDisciplina(nome: string) {
    const atuais = dados.componente.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!atuais.includes(nome)) set('componente', [...atuais, nome].join(', '));
  }

  async function salvar() {
    if (!servidor?.pessoa_id) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      await salvarDadosServidor(servidor.pessoa_id, {
        cpf: dados.cpf, dataNascimento: dados.dataNascimento, telefone: dados.celular, rg: dados.rg,
        tituloEleitor: dados.tituloEleitor, zonaEleitoral: dados.zonaEleitoral, secaoEleitoral: dados.secaoEleitoral,
        endereco: dados.endereco, telefoneFixo: dados.telefoneFixo, formacao: dados.formacao, matricula: '',
      });
      if (substituido?.pessoa_id && dados.substituidoMatricula.trim()) {
        await salvarMatriculaServidor(substituido.pessoa_id, dados.substituidoMatricula);
      }
      setMsg('Dados salvos no cadastro. Na próxima vez já vêm preenchidos.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  function imprimir() {
    gravarPrefs(dados);
    const janela = iframeRef.current?.contentWindow;
    janela?.focus();
    janela?.print();
  }

  const html = useMemo(() => gerarHtmlTermoConvocado(dados), [dados]);
  const vazio = (v: string) => !v.trim();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">1. Professor convocado</p>
          {carregando ? (
            <Loader2 className="w-5 h-5 animate-spin text-ms-blueText" />
          ) : (
            <SeletorServidor servidores={servidores} valor={servidor} onEscolher={escolherServidor} onLimpar={() => { setServidor(null); setDados({ ...VAZIO, ...lerPrefs() }); setDisciplinas([]); }} placeholder="Digite o nome do professor..." />
          )}
          {!servidor && <p className="text-[11px] text-gray-500">Escolha na lista para preencher sozinho. Se ele não estiver na lista, você pode digitar os campos abaixo e imprimir mesmo assim (só não dá para salvar no cadastro).</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="sm:col-span-2"><Campo rotulo="Nome completo" vazio={vazio(dados.nome)}><input value={dados.nome} onChange={(e) => set('nome', e.target.value)} className={`${classeInput} ${vazio(dados.nome) ? classeFalta : ''}`} /></Campo></div>
            <Campo rotulo="RG" vazio={vazio(dados.rg)}><input value={dados.rg} onChange={(e) => set('rg', e.target.value)} className={`${classeInput} ${vazio(dados.rg) ? classeFalta : ''}`} /></Campo>
            <Campo rotulo="CPF" vazio={vazio(dados.cpf)}><input inputMode="numeric" value={dados.cpf} onChange={(e) => set('cpf', formatarCpf(e.target.value))} className={`${classeInput} ${vazio(dados.cpf) ? classeFalta : ''}`} /></Campo>
            <Campo rotulo="Data de nascimento" vazio={vazio(dados.dataNascimento)}><input type="date" value={dados.dataNascimento} onChange={(e) => set('dataNascimento', e.target.value)} className={`${classeInput} ${vazio(dados.dataNascimento) ? classeFalta : ''}`} /></Campo>
            <Campo rotulo="Título eleitoral" vazio={vazio(dados.tituloEleitor)}><input value={dados.tituloEleitor} onChange={(e) => set('tituloEleitor', e.target.value)} className={`${classeInput} ${vazio(dados.tituloEleitor) ? classeFalta : ''}`} /></Campo>
            <Campo rotulo="Zona eleitoral"><input value={dados.zonaEleitoral} onChange={(e) => set('zonaEleitoral', e.target.value)} className={classeInput} /></Campo>
            <Campo rotulo="Seção"><input value={dados.secaoEleitoral} onChange={(e) => set('secaoEleitoral', e.target.value)} className={classeInput} /></Campo>
            <div className="sm:col-span-2"><Campo rotulo="Endereço residencial" vazio={vazio(dados.endereco)}><input value={dados.endereco} onChange={(e) => set('endereco', e.target.value)} className={`${classeInput} ${vazio(dados.endereco) ? classeFalta : ''}`} /></Campo></div>
            <Campo rotulo="Telefone fixo"><input value={dados.telefoneFixo} onChange={(e) => set('telefoneFixo', formatarTelefone(e.target.value))} className={classeInput} /></Campo>
            <Campo rotulo="Celular" vazio={vazio(dados.celular)}><input value={dados.celular} onChange={(e) => set('celular', formatarTelefone(e.target.value))} className={`${classeInput} ${vazio(dados.celular) ? classeFalta : ''}`} /></Campo>
            <div className="sm:col-span-2"><Campo rotulo="E-mail"><input type="email" value={dados.email} onChange={(e) => set('email', e.target.value)} className={classeInput} /></Campo></div>
            <div className="sm:col-span-2"><Campo rotulo="Formação / graduação / especialização" vazio={vazio(dados.formacao)}><input value={dados.formacao} onChange={(e) => set('formacao', e.target.value)} placeholder="Ex.: Licenciatura em Matemática — Especialização em Educação Especial" className={`${classeInput} ${vazio(dados.formacao) ? classeFalta : ''}`} /></Campo></div>
          </div>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !servidor?.pessoa_id}
            title={servidor ? '' : 'Escolha um professor da lista para salvar'}
            className="flex items-center gap-2 px-4 py-2 bg-ms-dark border border-gray-700 rounded-lg text-xs font-bold text-ms-main hover:border-ms-blue transition-colors disabled:opacity-40"
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar dados no cadastro do servidor
          </button>
        </div>

        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">2. Dados da convocação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo rotulo="1) Horas semanais"><input value={dados.horasSemanais} onChange={(e) => set('horasSemanais', e.target.value)} placeholder="Ex.: 20 horas" className={classeInput} /></Campo>
            <Campo rotulo="4) Período — de"><input type="date" value={dados.periodoDe} onChange={(e) => set('periodoDe', e.target.value)} className={classeInput} /></Campo>
            <div className="sm:col-span-2">
              <Campo rotulo="2) Componente curricular / disciplina / projeto">
                <textarea rows={2} value={dados.componente} onChange={(e) => set('componente', e.target.value)} className={classeInput} />
              </Campo>
              {disciplinas.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-gray-500">Do cadastro do professor:</span>
                  {disciplinas.map((nome) => (
                    <button key={nome} type="button" onClick={() => adicionarDisciplina(nome)} className="flex items-center gap-1 px-2 py-0.5 bg-ms-blue/10 border border-ms-blueText/20 rounded-full text-[11px] text-ms-blueText hover:bg-ms-blue/20">
                      <Plus className="w-3 h-3" />{nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2"><Campo rotulo="3) Escola / município onde prestará os serviços"><textarea rows={2} value={dados.escolaMunicipio} onChange={(e) => set('escolaMunicipio', e.target.value)} className={classeInput} /></Campo></div>
            <Campo rotulo="Período — até"><input type="date" value={dados.periodoAte} onChange={(e) => set('periodoAte', e.target.value)} className={classeInput} /></Campo>
            <div className="sm:col-span-2 space-y-2">
              <Campo rotulo="5) Em substituição ao professor(a) efetivo(a)">
                <SeletorServidor servidores={servidores} valor={substituido} onEscolher={escolherSubstituido} onLimpar={() => { setSubstituido(null); set('substituidoNome', ''); set('substituidoMatricula', ''); }} placeholder="Digite o nome do professor efetivo..." />
              </Campo>
              {!substituido && <input value={dados.substituidoNome} onChange={(e) => set('substituidoNome', e.target.value)} placeholder="Ou digite o nome à mão" className={classeInput} />}
            </div>
            <div className="sm:col-span-2"><Campo rotulo="Matrícula do professor efetivo"><input value={dados.substituidoMatricula} onChange={(e) => set('substituidoMatricula', e.target.value)} className={classeInput} /></Campo></div>
            <Campo rotulo="6) Valor da hora-aula (R$)"><input value={dados.valorHora} onChange={(e) => set('valorHora', e.target.value)} className={classeInput} /></Campo>
            <Campo rotulo="Fundamento do valor"><input value={dados.fundamentoValor} onChange={(e) => set('fundamentoValor', e.target.value)} className={classeInput} /></Campo>
          </div>
        </div>

        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">3. Local e data da assinatura</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo rotulo="Cidade"><input value={dados.cidade} onChange={(e) => set('cidade', e.target.value)} className={classeInput} /></Campo>
            <Campo rotulo="Data"><input type="date" value={dados.dataDocumento} onChange={(e) => set('dataDocumento', e.target.value)} className={classeInput} /></Campo>
          </div>
        </div>

        <div className="bg-ms-card border border-gray-800 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">4. Termo assinado (escaneado)</p>
          {servidor?.pessoa_id ? (
            <DocumentosServidor pessoaId={servidor.pessoa_id} tipo="TERMO_CONVOCACAO_ASSINADO" nomeServidor={servidor.nome} />
          ) : (
            <p className="text-[11px] text-gray-500">Escolha o professor na lista (passo 1) para guardar o termo assinado na ficha dele.</p>
          )}
        </div>

        {erro && <p className="text-xs text-red-400">{erro}</p>}
        {msg && <p className="text-xs text-green-400">{msg}</p>}
        <button type="button" onClick={imprimir} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-ms-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all">
          <Printer className="w-4 h-4" /> Imprimir termo (frente e verso)
        </button>
      </div>

      <div className="xl:sticky xl:top-4">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main mb-2">Prévia (igual ao impresso)</p>
        <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-300" style={{ height: 'min(80vh, 900px)' }}>
          <div style={{ width: 794 * 0.78, height: 2290 * 0.78, margin: '0 auto' }}>
            <iframe
              ref={iframeRef}
              title="Prévia do termo"
              srcDoc={html}
              style={{ width: '794px', height: '2290px', border: 0, display: 'block', transform: 'scale(0.78)', transformOrigin: 'top left' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
