import { useState } from 'react';
import { AlertTriangle, Check, Loader2, Search } from 'lucide-react';
import type { FolhaIdentificada, LinhaGabarito, ResultadoCorrecaoOmr } from '../../types/correcaoOmr';
import { corrigirPorOmr, identificarFolha, obterGabaritoVersao } from '../../services/correcaoOmrService';

// Correção digitando, para quando a câmera não resolve: cartão rasgado, folha
// fotocopiada com o QR borrado, celular sem permissão de câmera, aluno que marcou a
// resposta fora da bolha.
//
// O caminho continua sendo o mesmo do OMR — mesma RPC, mesma tradução de bolha para
// alternativa, mesmo registro em prova_leituras (com origem MANUAL). Ter um segundo
// caminho de correção com regras próprias é como se instala uma divergência entre a
// nota da câmera e a nota digitada para o mesmo cartão.

const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

export function CorrecaoManualPainel({ onCorrigido }: { onCorrigido?: (r: ResultadoCorrecaoOmr) => void }) {
  const [codigo, setCodigo] = useState('');
  const [folha, setFolha] = useState<FolhaIdentificada | null>(null);
  const [gabarito, setGabarito] = useState<LinhaGabarito[]>([]);
  const [marcacoes, setMarcacoes] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCorrecaoOmr | null>(null);

  async function buscar() {
    const limpo = codigo.trim().toUpperCase();
    if (!limpo) return;
    setBuscando(true);
    setErro(null);
    setResultado(null);
    try {
      const f = await identificarFolha(limpo);
      const g = await obterGabaritoVersao(f.prova_id, f.versao);
      setFolha(f);
      setGabarito(g);
      setMarcacoes(new Array(g.length).fill(''));
    } catch (e) {
      setFolha(null);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBuscando(false);
    }
  }

  function marcar(indice: number, letra: string) {
    setMarcacoes((atual) => {
      const novo = [...atual];
      // Tocar de novo na mesma letra apaga: é como se desmarca sem precisar de um botão
      // "limpar" por linha.
      novo[indice] = novo[indice] === letra ? '' : letra;
      return novo;
    });
  }

  async function salvar() {
    if (!folha) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await corrigirPorOmr(folha.codigo, marcacoes, 'MANUAL');
      setResultado(r);
      onCorrigido?.(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  function limpar() {
    setCodigo('');
    setFolha(null);
    setGabarito([]);
    setMarcacoes([]);
    setResultado(null);
    setErro(null);
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div>
        <label className="text-xs font-bold text-ms-muted">Código impresso no cartão</label>
        <div className="flex gap-2 mt-1">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') void buscar(); }}
            placeholder="Ex.: K7M2QW4RHD"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 px-3 py-2.5 bg-ms-dark border border-gray-800 rounded-lg text-ms-main font-mono tracking-widest outline-none focus:ring-2 focus:ring-ms-blue"
          />
          <button
            onClick={() => void buscar()}
            disabled={buscando || !codigo.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
          >
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300 font-medium">{erro}</p>
        </div>
      )}

      {folha && (
        <>
          <div className="bg-ms-card border border-gray-800 rounded-lg px-3 py-2.5">
            <p className="text-sm font-bold text-ms-main">{folha.aluno_nome}</p>
            <p className="text-xs text-ms-muted">
              {folha.serie_nome ? `${folha.serie_nome} — ` : ''}Turma {folha.turma_nome ?? '—'}
              {folha.numero_chamada != null ? ` · Nº ${folha.numero_chamada}` : ''} · Versão {folha.versao}
            </p>
            <p className="text-xs text-ms-muted mt-0.5">{folha.titulo}</p>
            {folha.ja_corrigido && (
              <p className="text-xs text-amber-300 font-medium mt-1">
                Este cartão já foi corrigido — salvar de novo substitui a leitura anterior.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            {gabarito.map((linha, i) => (
              <div key={linha.question_id} className="flex items-center gap-2">
                <span className="w-8 text-right text-xs font-bold text-ms-muted shrink-0">
                  {linha.numero_na_prova}
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {LETRAS.slice(0, linha.qtd_alternativas).map((letra) => (
                    <button
                      key={letra}
                      onClick={() => marcar(i, letra)}
                      className={`w-9 h-9 rounded-full border text-xs font-bold transition-colors ${
                        marcacoes[i] === letra
                          ? 'bg-ms-blue border-ms-blue text-white'
                          : 'bg-ms-dark border-gray-700 text-ms-muted hover:border-gray-500'
                      }`}
                    >
                      {letra}
                    </button>
                  ))}
                  <button
                    onClick={() => marcar(i, '*')}
                    title="Anulada (o aluno marcou mais de uma)"
                    className={`w-9 h-9 rounded-full border text-xs font-bold ${
                      marcacoes[i] === '*'
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-ms-dark border-gray-800 text-gray-600 hover:border-gray-600'
                    }`}
                  >
                    ✳
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 sticky bottom-0 bg-ms-dark py-3">
            <span className="text-xs text-ms-muted">
              {marcacoes.filter((m) => m !== '').length} de {gabarito.length} preenchidas
            </span>
            <div className="flex gap-2">
              <button onClick={limpar} className="px-4 py-2 rounded-lg border border-gray-800 text-ms-main text-sm font-bold hover:bg-gray-800">
                Outro cartão
              </button>
              <button
                onClick={() => void salvar()}
                disabled={salvando}
                className="flex items-center gap-2 px-5 py-2 bg-ms-blue text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-40"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar correção
              </button>
            </div>
          </div>
        </>
      )}

      {resultado && (
        <div className="flex items-center gap-2 bg-green-950/40 border border-green-900 rounded-lg px-3 py-2">
          <Check className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-xs text-green-200 font-bold">
            {resultado.acertos}/{resultado.total_linhas} acertos
            {resultado.modo_nota !== 'SEM_NOTA' && resultado.nota != null
              ? ` · nota ${Number(resultado.nota).toFixed(2)} de ${Number(resultado.valor_total).toFixed(2)}`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
}
