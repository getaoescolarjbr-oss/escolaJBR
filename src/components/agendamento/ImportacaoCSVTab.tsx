import { useState } from 'react';
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileUp } from 'lucide-react';
import { parseCsv } from '../../lib/csv';
import type { ValidacaoLinhaRecurso, ImportacaoLinhaRecurso, ValidacaoLinhaSerie, ImportacaoLinhaSerie } from '../../types/agendamento';
import { dryRunImportacaoRecursos, importarRecursos, dryRunImportacaoSeries, importarSeries } from '../../services/agendamentoService';

type TipoImportacao = 'RECURSOS' | 'SERIES';

export function ImportacaoCSVTab() {
  const [tipo, setTipo] = useState<TipoImportacao>('RECURSOS');
  const [linhasCsv, setLinhasCsv] = useState<Record<string, string>[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [validandoOuImportando, setValidandoOuImportando] = useState(false);
  const [dryRunRecursos, setDryRunRecursos] = useState<ValidacaoLinhaRecurso[] | null>(null);
  const [dryRunSeries, setDryRunSeries] = useState<ValidacaoLinhaSerie[] | null>(null);
  const [resultadoRecursos, setResultadoRecursos] = useState<ImportacaoLinhaRecurso[] | null>(null);
  const [resultadoSeries, setResultadoSeries] = useState<ImportacaoLinhaSerie[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function resetar() {
    setLinhasCsv([]);
    setNomeArquivo('');
    setDryRunRecursos(null);
    setDryRunSeries(null);
    setResultadoRecursos(null);
    setResultadoSeries(null);
    setErro(null);
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    resetar();
    setNomeArquivo(arquivo.name);
    const texto = await arquivo.text();
    const linhas = parseCsv(texto);
    if (linhas.length === 0) {
      setErro('Arquivo vazio ou sem linhas de dados (só cabeçalho).');
      return;
    }
    setLinhasCsv(linhas);
  }

  async function handlePreVisualizar() {
    setValidandoOuImportando(true);
    setErro(null);
    try {
      if (tipo === 'RECURSOS') {
        setDryRunRecursos(await dryRunImportacaoRecursos(linhasCsv));
      } else {
        setDryRunSeries(await dryRunImportacaoSeries(linhasCsv));
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao pré-visualizar importação.');
    } finally {
      setValidandoOuImportando(false);
    }
  }

  async function handleImportar() {
    setValidandoOuImportando(true);
    setErro(null);
    try {
      if (tipo === 'RECURSOS') {
        setResultadoRecursos(await importarRecursos(linhasCsv));
      } else {
        setResultadoSeries(await importarSeries(linhasCsv));
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao importar.');
    } finally {
      setValidandoOuImportando(false);
    }
  }

  const dryRunPronto = tipo === 'RECURSOS' ? dryRunRecursos !== null : dryRunSeries !== null;
  const temLinhaValida = tipo === 'RECURSOS'
    ? (dryRunRecursos ?? []).some((l) => l.valido)
    : (dryRunSeries ?? []).some((l) => l.valido);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl text-xs text-blue-900 dark:text-blue-300 leading-relaxed shadow-sm">
        A pré-visualização (dry-run) roda no servidor e nunca grava nada — recusa linhas inválidas/duplicadas antes de
        importar de verdade. A importação real revalida cada linha novamente (não confia só na pré-visualização).
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { setTipo('RECURSOS'); resetar(); }}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            tipo === 'RECURSOS'
              ? 'bg-ms-blue text-white shadow-md'
              : 'bg-white dark:bg-ms-card text-ms-blue dark:text-gray-300 hover:bg-ms-blue/10 hover:text-ms-blue border border-ms-blue/30 dark:border-gray-700 shadow-sm'
          }`}
        >
          Recursos
        </button>
        <button
          onClick={() => { setTipo('SERIES'); resetar(); }}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            tipo === 'SERIES'
              ? 'bg-ms-blue text-white shadow-md'
              : 'bg-white dark:bg-ms-card text-ms-blue dark:text-gray-300 hover:bg-ms-blue/10 hover:text-ms-blue border border-ms-blue/30 dark:border-gray-700 shadow-sm'
          }`}
        >
          Aulas fixas (séries)
        </button>
      </div>

      <div className="bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-ms-main">Colunas esperadas</p>
        {tipo === 'RECURSOS' ? (
          <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-ms-dark p-3 rounded-xl border border-gray-200 dark:border-gray-800">
            nome, tipo (LABORATORIO/SALA/QUADRA/EQUIPAMENTO/OUTRO), descricao, capacidade, local, requer_aprovacao (true/false)
          </p>
        ) : (
          <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-ms-dark p-3 rounded-xl border border-gray-200 dark:border-gray-800">
            recurso_nome, professor_nome, turma_nome (opcional), dia_semana (0=domingo..6=sábado), hora_inicio, hora_fim, vigencia_inicio, vigencia_fim, finalidade
          </p>
        )}

        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-ms-blue dark:text-gray-300 dark:hover:text-white cursor-pointer px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl w-fit transition-colors shadow-sm">
          <FileUp className="w-4 h-4" /> {nomeArquivo || 'Escolher arquivo CSV...'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleArquivo} />
        </label>

        {linhasCsv.length > 0 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{linhasCsv.length} linha(s) lida(s) do arquivo.</p>
        )}

        {erro && <p className="text-xs text-red-500 font-medium">{erro}</p>}

        {linhasCsv.length > 0 && !dryRunPronto && (
          <button
            onClick={handlePreVisualizar}
            disabled={validandoOuImportando}
            className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-sm"
          >
            {validandoOuImportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Pré-visualizar (dry-run)
          </button>
        )}
      </div>

      {tipo === 'RECURSOS' && dryRunRecursos && (
        <div className="bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-ms-main">
            Pré-visualização — {dryRunRecursos.filter((l) => l.valido).length} válida(s) de {dryRunRecursos.length}
          </p>
          <div className="space-y-1.5">
            {dryRunRecursos.map((l) => (
              <div
                key={l.linha}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border ${
                  l.valido
                    ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/10 dark:text-green-400 dark:border-green-900/30'
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30'
                }`}
              >
                <span className="font-medium">Linha {l.linha}: {l.nome || '(sem nome)'}</span>
                <span className="flex items-center gap-1 font-semibold">
                  {l.valido ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {l.valido ? 'OK' : l.motivo}
                </span>
              </div>
            ))}
          </div>
          {!resultadoRecursos && temLinhaValida && (
            <button
              onClick={handleImportar}
              disabled={validandoOuImportando}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 mt-2 shadow-sm"
            >
              {validandoOuImportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Importar linhas válidas
            </button>
          )}
          {resultadoRecursos && (
            <p className="text-xs text-emerald-600 dark:text-green-400 font-bold pt-2">
              {resultadoRecursos.filter((l) => l.sucesso).length} recurso(s) importado(s) com sucesso.
            </p>
          )}
        </div>
      )}

      {tipo === 'SERIES' && dryRunSeries && (
        <div className="bg-white dark:bg-ms-card border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-ms-main">
            Pré-visualização — {dryRunSeries.filter((l) => l.valido).length} válida(s) de {dryRunSeries.length}
          </p>
          <div className="space-y-1.5">
            {dryRunSeries.map((l) => (
              <div
                key={l.linha}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border ${
                  l.valido
                    ? l.conflitos_previstos > 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/10 dark:text-amber-500 dark:border-amber-900/30'
                      : 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/10 dark:text-green-400 dark:border-green-900/30'
                    : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/10 dark:text-red-400 dark:border-red-900/30'
                }`}
              >
                <span className="font-medium">Linha {l.linha}: {l.recurso_nome ?? '?'} — {l.professor_nome ?? '?'}</span>
                <span className="flex items-center gap-1 font-semibold">
                  {l.valido ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {l.valido ? (l.conflitos_previstos > 0 ? `OK (${l.conflitos_previstos} conflito(s) previsto(s))` : 'OK') : l.motivo}
                </span>
              </div>
            ))}
          </div>
          {!resultadoSeries && temLinhaValida && (
            <button
              onClick={handleImportar}
              disabled={validandoOuImportando}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 mt-2 shadow-sm"
            >
              {validandoOuImportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Importar séries válidas
            </button>
          )}
          {resultadoSeries && (
            <div className="pt-2 space-y-1">
              {resultadoSeries.map((r) => (
                <p key={r.linha} className="text-xs text-gray-700 dark:text-gray-400">
                  Linha {r.linha}: {r.sucesso ? `${r.ocorrencias_criadas} ocorrência(s) criada(s)${r.ocorrencias_com_conflito ? `, ${r.ocorrencias_com_conflito} conflito(s)` : ''}` : r.motivo}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
