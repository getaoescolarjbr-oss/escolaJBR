import { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import type { Pessoa } from '../../types/pessoas';
import type { Matricula, SerieReferencia, Turno } from '../../types/secretaria';
import { obterVinculos, listarResponsaveisDoAluno } from '../../services/pessoasService';
import { listarConsentimentos, registrarConsentimento } from '../../services/lgpdService';
import { obterMatricula, listarSeries, criarMatricula, atualizarMatricula } from '../../services/secretariaService';

const ANO_ATUAL = new Date().getFullYear();

interface MatriculaTabProps {
  pessoa: Pessoa;
}

export function MatriculaTab({ pessoa }: MatriculaTabProps) {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<SerieReferencia[]>([]);
  const [matricula, setMatricula] = useState<Matricula | null>(null);
  const [temConsentimento, setTemConsentimento] = useState(false);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<{ responsavelId: string; pessoaId: string; nome: string }[]>([]);
  const [aceitanteSelecionado, setAceitanteSelecionado] = useState('');
  const [registrandoConsentimento, setRegistrandoConsentimento] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Matricula>>({
    ano_letivo: ANO_ATUAL,
    turno: 'Matutino' as Turno,
    serie_id: '',
    escola_procedencia: '',
    endereco_logradouro: '',
    endereco_numero: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_uf: '',
    endereco_cep: '',
    status_matricula: 'ATIVA',
  });

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [listaSeries, matriculaAtual, consentimentos, vinculos] = await Promise.all([
        listarSeries(),
        obterMatricula(pessoa.id, ANO_ATUAL),
        listarConsentimentos(pessoa.id),
        obterVinculos(pessoa.id),
      ]);
      setSeries(listaSeries.filter((s) => s.ativo));
      setMatricula(matriculaAtual);
      if (matriculaAtual) setForm(matriculaAtual);
      setTemConsentimento(consentimentos.some((c) => c.tipo === 'CADASTRO' && c.aceito));
      setAlunoId(vinculos.aluno?.id ?? null);

      if (vinculos.aluno) {
        const lista = await listarResponsaveisDoAluno(vinculos.aluno.id);
        setResponsaveis(lista);
        setAceitanteSelecionado(lista[0]?.pessoaId ?? pessoa.id);
      } else {
        setAceitanteSelecionado(pessoa.id);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar dados de matrícula.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa.id]);

  async function handleRegistrarConsentimento() {
    setRegistrandoConsentimento(true);
    setErro(null);
    try {
      await registrarConsentimento(pessoa.id, aceitanteSelecionado, 'CADASTRO', true);
      setTemConsentimento(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar consentimento.');
    } finally {
      setRegistrandoConsentimento(false);
    }
  }

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (!form.serie_id || !form.turno) {
        setErro('Selecione série e turno.');
        return;
      }
      if (matricula) {
        await atualizarMatricula(matricula.id, form);
      } else {
        await criarMatricula({
          pessoa_id: pessoa.id,
          ano_letivo: ANO_ATUAL,
          serie_id: form.serie_id,
          turno: form.turno as Turno,
          data_matricula: new Date().toISOString().slice(0, 10),
          escola_procedencia: form.escola_procedencia || null,
          endereco_logradouro: form.endereco_logradouro || null,
          endereco_numero: form.endereco_numero || null,
          endereco_bairro: form.endereco_bairro || null,
          endereco_cidade: form.endereco_cidade || null,
          endereco_uf: form.endereco_uf || null,
          endereco_cep: form.endereco_cep || null,
          status_matricula: 'ATIVA',
          motivo_saida: null,
          data_saida: null,
          observacoes: form.observacoes || null,
        });
      }
      await carregar();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar matrícula.';
      setErro(msg.includes('consentimento') ? 'É preciso registrar o consentimento de Cadastro antes de matricular (veja acima).' : msg);
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-ms-blueText" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {erro && <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg text-sm text-red-400">{erro}</div>}

      {!temConsentimento && (
        <div className="p-4 rounded-xl border border-yellow-700/40 bg-yellow-950/10">
          <p className="text-sm font-black text-yellow-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Consentimento de Cadastro pendente
          </p>
          <p className="text-xs text-gray-400 mt-1">
            A matrícula não pode ser criada sem um consentimento de Cadastro aceito para esta pessoa (o banco recusa a
            gravação). Escolha quem está aceitando e registre antes de continuar.
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <select
              value={aceitanteSelecionado}
              onChange={(e) => setAceitanteSelecionado(e.target.value)}
              className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            >
              {responsaveis.map((r) => (
                <option key={r.pessoaId} value={r.pessoaId}>{r.nome} (responsável)</option>
              ))}
              <option value={pessoa.id}>{pessoa.nome} (a própria pessoa)</option>
            </select>
            <button
              onClick={handleRegistrarConsentimento}
              disabled={registrandoConsentimento}
              className="px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all disabled:opacity-50"
            >
              {registrandoConsentimento ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar consentimento'}
            </button>
          </div>
        </div>
      )}

      {!alunoId && (
        <p className="text-xs text-gray-500">
          Esta pessoa ainda não tem registro de Aluno vinculado — a matrícula aqui registra os dados formais mesmo
          assim, mas a operação de turma/chamada continua dependendo de um registro em Alunos (Painel Admin).
        </p>
      )}

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-4">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Ficha de Matrícula — {ANO_ATUAL}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Série/Segmento</label>
            <select
              value={form.serie_id}
              onChange={(e) => setForm({ ...form, serie_id: e.target.value })}
              className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            >
              <option value="">Selecionar...</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Turno</label>
            <select
              value={form.turno}
              onChange={(e) => setForm({ ...form, turno: e.target.value as Turno })}
              className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            >
              <option value="Matutino">Matutino</option>
              <option value="Vespertino">Vespertino</option>
              <option value="Noturno">Noturno</option>
              <option value="Integral">Integral</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Escola de Procedência (se houver)</label>
          <input
            type="text"
            value={form.escola_procedencia ?? ''}
            onChange={(e) => setForm({ ...form, escola_procedencia: e.target.value })}
            className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          />
        </div>

        <p className="text-xs font-black uppercase tracking-wider text-ms-main pt-2">Endereço</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder="Logradouro" value={form.endereco_logradouro ?? ''} onChange={(e) => setForm({ ...form, endereco_logradouro: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue md:col-span-2" />
          <input placeholder="Número" value={form.endereco_numero ?? ''} onChange={(e) => setForm({ ...form, endereco_numero: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Bairro" value={form.endereco_bairro ?? ''} onChange={(e) => setForm({ ...form, endereco_bairro: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="Cidade" value={form.endereco_cidade ?? ''} onChange={(e) => setForm({ ...form, endereco_cidade: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
          <input placeholder="UF" maxLength={2} value={form.endereco_uf ?? ''} onChange={(e) => setForm({ ...form, endereco_uf: e.target.value.toUpperCase() })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue uppercase" />
          <input placeholder="CEP" value={form.endereco_cep ?? ''} onChange={(e) => setForm({ ...form, endereco_cep: e.target.value })} className="px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue" />
        </div>

        {matricula && (
          <div className="space-y-2 pt-2">
            <label className="text-xs font-black text-[#003366] uppercase tracking-wider ml-1">Status da Matrícula</label>
            <select
              value={form.status_matricula}
              onChange={(e) => setForm({ ...form, status_matricula: e.target.value as Matricula['status_matricula'] })}
              className="w-full px-4 py-3 bg-ms-dark border border-gray-800 rounded-xl text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
            >
              <option value="ATIVA">Ativa</option>
              <option value="ENCERRADA">Encerrada</option>
              <option value="TRANSFERIDA">Transferida (para outra escola)</option>
            </select>
          </div>
        )}

        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="flex items-center gap-2 px-6 py-3 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {matricula ? 'Salvar Alterações' : 'Criar Matrícula'}
        </button>
      </div>
    </div>
  );
}
