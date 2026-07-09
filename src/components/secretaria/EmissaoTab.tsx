import { useEffect, useState } from 'react';
import { Loader2, FileOutput, Printer } from 'lucide-react';
import type { Pessoa } from '../../types/pessoas';
import type { DocumentoEmitido, TipoDocumentoEmitido, SerieReferencia } from '../../types/secretaria';
import { obterMatricula, listarSeries } from '../../services/secretariaService';
import { emitirDocumento, listarDocumentosEmitidos, imprimirDocumentoEmitido } from '../../services/emissaoService';

const ANO_ATUAL = new Date().getFullYear();

const TIPOS_DISPONIVEIS: { valor: TipoDocumentoEmitido; rotulo: string }[] = [
  { valor: 'DECLARACAO_MATRICULA', rotulo: 'Declaração de Matrícula' },
  { valor: 'ATESTADO_FREQUENCIA', rotulo: 'Atestado de Frequência' },
];

interface EmissaoTabProps {
  pessoa: Pessoa;
}

export function EmissaoTab({ pessoa }: EmissaoTabProps) {
  const [loading, setLoading] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [tipo, setTipo] = useState<TipoDocumentoEmitido>('DECLARACAO_MATRICULA');
  const [emitidos, setEmitidos] = useState<DocumentoEmitido[]>([]);
  const [series, setSeries] = useState<SerieReferencia[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [lista, listaSeries] = await Promise.all([listarDocumentosEmitidos(pessoa.id), listarSeries()]);
      setEmitidos(lista);
      setSeries(listaSeries);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoa.id]);

  async function handleEmitir() {
    setEmitindo(true);
    setErro(null);
    try {
      const matricula = await obterMatricula(pessoa.id, ANO_ATUAL);
      const serie = matricula ? series.find((s) => s.id === matricula.serie_id) : undefined;

      const snapshot = {
        pessoa_nome: pessoa.nome,
        pessoa_cpf: pessoa.cpf,
        ano_letivo: matricula?.ano_letivo ?? ANO_ATUAL,
        serie_nome: serie?.nome,
        turno: matricula?.turno,
      };

      const doc = await emitirDocumento(tipo, pessoa.id, matricula?.id ?? null, snapshot);
      await carregar();
      imprimirDocumentoEmitido(doc);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao emitir documento.');
    } finally {
      setEmitindo(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Emitir documento</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDocumentoEmitido)}
            className="px-3 py-2 bg-ms-dark border border-gray-800 rounded-lg text-sm text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
          >
            {TIPOS_DISPONIVEIS.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>
          <button
            onClick={handleEmitir}
            disabled={emitindo}
            className="flex items-center gap-2 px-4 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            {emitindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileOutput className="w-4 h-4" />}
            Emitir e imprimir
          </button>
        </div>
        <p className="text-[10px] text-gray-500">
          Histórico Escolar e Declaração de Transferência ainda não estão disponíveis nesta fase (o Histórico depende de
          dados de anos letivos anteriores que ainda não existem no banco).
        </p>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Documentos já emitidos</p>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ms-blue" /></div>
        ) : emitidos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum documento emitido ainda.</p>
        ) : (
          emitidos.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3 bg-ms-card border border-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-bold text-ms-main">{TIPOS_DISPONIVEIS.find((t) => t.valor === doc.tipo)?.rotulo ?? doc.tipo}</p>
                <p className="text-[10px] text-gray-500">Nº {doc.numero}/{doc.ano} · {new Date(doc.emitido_em).toLocaleString('pt-BR')}</p>
              </div>
              <button onClick={() => imprimirDocumentoEmitido(doc)} className="p-2 hover:bg-ms-blue/20 text-ms-blue rounded-lg transition-all" title="Reimprimir">
                <Printer className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
