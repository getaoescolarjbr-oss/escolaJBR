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
      <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-lg text-xs text-blue-300">
        A pré-visualização (dry-run) roda no servidor e nunca grava nada — recusa linhas inválidas/duplicadas antes de
        importar de verdade. A importação real revalida cada linha novamente (não confia só na pré-visualização).
      </div>

      <div className="flex gap-2">
        <button onClick={() => { setTipo('RECURSOS'); resetar(); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tipo === 'RECURSOS' ? 'bg-ms-blue text-white' : 'bg-ms-card text-gray-400 border border-gray-800'}`}>Recursos</button>
        <button onClick={() => { setTipo('SERIES'); resetar(); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tipo === 'SERIES' ? 'bg-ms-blue text-white' : 'bg-ms-card text-gray-400 border border-gray-800'}`}>Aulas fixas (séries)</button>
      </div>

      <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-ms-main">Colunas esperadas</p>
        {tipo === 'RECURSOS' ? (
          <p className="text-xs text-gray-400 font-mono">nome, tipo (LABORATORIO/SALA/QUADRA/EQUIPAMENTO/OUTRO), descricao, capacidade, local, requer_aprovacao (true/false)</p>
        ) : (
          <p className="text-xs text-gray-400 font-mono">recurso_nome, professor_nome, turma_nome (opcional), dia_semana (0=domingo..6=sábado), hora_inicio, hora_fim, vigencia_inicio, vigencia_fim, finalidade</p>
        )}

        <label className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-200 cursor-pointer w-fit">
          <FileUp className="w-4 h-4" /> {nomeArquivo || 'Escolher arquivo CSV...'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleArquivo} />
        </label>

        {linhasCsv.length > 0 && (
          <p className="text-xs text-gray-500">{linhasCsv.length} linha(s) lida(s) do arquivo.</p>
        )}

        {erro && <p className="text-xs text-red-400">{erro}</p>}

        {linhasCsv.length > 0 && !dryRunPronto && (
          <button onClick={handlePreVisualizar} disabled={validandoOuImportando} className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50">
            {validandoOuImportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Pré-visualizar (dry-run)
          </button>
        )}
      </div>

      {tipo === 'RECURSOS' && dryRunRecursos && (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">Pré-visualização — {dryRunRecursos.filter((l) => l.valido).length} válida(s) de {dryRunRecursos.length}</p>
          {dryRunRecursos.map((l) => (
            <div key={l.linha} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${l.valido ? 'bg-green-950/10 text-green-400' : 'bg-red-950/10 text-red-400'}`}>
              <span>Linha {l.linha}: {l.nome || '(sem nome)'}</span>
              <span className="flex items-center gap-1">
                {l.valido ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {l.valido ? 'OK' : l.motivo}
              </span>
            </div>
          ))}
          {!resultadoRecursos && temLinhaValida && (
            <button onClick={handleImportar} disabled={validandoOuImportando} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 mt-2">
              {validandoOuImportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Importar linhas válidas
            </button>
          )}
          {resultadoRecursos && (
            <p className="text-xs text-green-400 font-bold pt-2">{resultadoRecursos.filter((l) => l.sucesso).length} recurso(s) importado(s) com sucesso.</p>
          )}
        </div>
      )}

      {tipo === 'SERIES' && dryRunSeries && (
        <div className="bg-ms-card border border-gray-800 rounded-2xl p-6 space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">Pré-visualização — {dryRunSeries.filter((l) => l.valido).length} válida(s) de {dryRunSeries.length}</p>
          {dryRunSeries.map((l) => (
            <div key={l.linha} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${l.valido ? (l.conflitos_previstos > 0 ? 'bg-amber-950/10 text-amber-500' : 'bg-green-950/10 text-green-400') : 'bg-red-950/10 text-red-400'}`}>
              <span>Linha {l.linha}: {l.recurso_nome ?? '?'} — {l.professor_nome ?? '?'}</span>
              <span className="flex items-center gap-1">
                {l.valido ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {l.valido ? (l.conflitos_previstos > 0 ? `OK (${l.conflitos_previstos} conflito(s) previsto(s))` : 'OK') : l.motivo}
              </span>
            </div>
          ))}
          {!resultadoSeries && temLinhaValida && (
            <button onClick={handleImportar} disabled={validandoOuImportando} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 mt-2">
              {validandoOuImportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Importar séries válidas
            </button>
          )}
          {resultadoSeries && (
            <div className="pt-2 space-y-1">
              {resultadoSeries.map((r) => (
                <p key={r.linha} className="text-xs text-gray-400">
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
