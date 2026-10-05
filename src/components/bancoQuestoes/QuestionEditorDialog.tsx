import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import type { Alternative, FilterOptions, Question, TipoQuestao } from '../../types/bancoQuestoes';
import {
  LINHAS_RESPOSTA_PADRAO,
  TIPOS_QUESTAO,
  TIPO_QUESTAO_LABEL,
  ehQuestaoEscrita,
  normalizarTipoQuestao,
  ordenarAlternativas,
} from '../../types/bancoQuestoes';
import {
  atualizarQuestao,
  buscarFilterOptions,
  buscarTopicosPorAssunto,
  criarQuestao,
  salvarTextoApoio,
} from '../../services/bancoQuestoesService';
import { MarkupToolbar } from './MarkupToolbar';
import { AutocompleteField } from './AutocompleteField';

interface Props {
  questao: Question | null;
  onClose: () => void;
  onSalvo: () => void;
}

// Dificuldade é uma lista fechada (o banco só aceita estes 3 valores): só seleção, nunca digitada,
// para não surgir variações como "Fácil" ao lado de "FÁCIL".
const DIFICULDADES = ['FÁCIL', 'MÉDIO', 'DIFÍCIL'] as const;

// Valor antigo digitado de outro jeito ("Fácil", "facil") vira o padrão correspondente.
function normalizarDificuldade(valor: string | null | undefined): string {
  const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const v = semAcento((valor ?? '').trim());
  return DIFICULDADES.find((d) => semAcento(d) === v) ?? '';
}

const inputClass = 'w-full px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue';

function novaAlternativa(letter: string): Alternative {
  return { letter, text: '', image_url: null };
}

// Campo com barra de formatação (negrito, itálico, sub/sobrescrito, imagem, símbolos e
// marcadores) que grava as marcações no mesmo formato ([[IMG:url]], <strong>, etc.) já
// interpretado por questionMarkup.tsx ao exibir as questões.
function CampoComMarcacao({
  value,
  onChange,
  placeholder,
  rows = 4,
  showImage = true,
  showList = true,
  onErro,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  showImage?: boolean;
  showList?: boolean;
  onErro: (msg: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Mudanças vindas da barra/painel de imagens regravam o texto inteiro; sem isto o navegador
  // joga a rolagem do campo (e do diálogo) pro fim. Guarda as posições e restaura depois que
  // a barra reposiciona o cursor.
  function alterarPreservandoRolagem(novo: string) {
    const el = ref.current;
    if (!el) {
      onChange(novo);
      return;
    }
    const topo = el.scrollTop;
    const pais: Array<[HTMLElement, number]> = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p.scrollHeight > p.clientHeight) pais.push([p, p.scrollTop]);
    }
    onChange(novo);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.scrollTop = topo;
        pais.forEach(([p, t]) => {
          p.scrollTop = t;
        });
      })
    );
  }

  const imagens = [...value.matchAll(/\[\[IMG:([^\]]*?)\]\]/g)].map((m) => {
    const parsed = m[1].trim().match(/^(.*)\|(\d+)$/);
    return { url: (parsed ? parsed[1] : m[1]).trim(), largura: parsed ? Number(parsed[2]) : null };
  });

  function definirLargura(indice: number, largura: number | null) {
    let n = -1;
    const novo = value.replace(/\[\[IMG:([^\]]*?)\]\]/g, (_t, conteudo: string) => {
      n += 1;
      if (n !== indice) return `[[IMG:${conteudo}]]`;
      const url = conteudo.trim().replace(/\|\d+$/, '');
      return largura ? `[[IMG:${url}|${Math.max(40, Math.min(1200, Math.round(largura)))}]]` : `[[IMG:${url}]]`;
    });
    alterarPreservandoRolagem(novo);
  }

  return (
    <div>
      <MarkupToolbar textareaRef={ref} value={value} onChange={alterarPreservandoRolagem} folder="questoes" showImage={showImage} showList={showList} onErro={onErro} />
      <textarea
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`${inputClass} mt-1 resize-y`}
      />
      {imagens.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-gray-800 bg-ms-dark/40 p-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-ms-muted">Tamanho das imagens (largura em px)</p>
          {imagens.map((img, i) => (
            <div key={`${img.url}-${i}`} className="flex items-center gap-2">
              <img src={img.url} alt="" className="h-9 w-12 shrink-0 rounded border border-gray-800 object-contain bg-white" />
              <span className="w-14 shrink-0 text-xs text-ms-muted">Imagem {i + 1}</span>
              <button type="button" onClick={() => definirLargura(i, (img.largura ?? 400) - 50)} className="rounded-lg border border-gray-800 px-2 py-1 text-xs font-bold text-ms-main hover:bg-ms-dark">−</button>
              <input
                type="number"
                min={40}
                max={1200}
                step={10}
                placeholder="auto"
                value={img.largura ?? ''}
                onChange={(e) => definirLargura(i, e.target.value ? Number(e.target.value) : null)}
                className="w-20 rounded-lg border border-gray-800 bg-ms-dark px-2 py-1 text-xs text-ms-main outline-none focus:ring-2 focus:ring-ms-blue"
              />
              <button type="button" onClick={() => definirLargura(i, (img.largura ?? 400) + 50)} className="rounded-lg border border-gray-800 px-2 py-1 text-xs font-bold text-ms-main hover:bg-ms-dark">+</button>
              <button type="button" onClick={() => definirLargura(i, null)} className="rounded-lg px-2 py-1 text-xs font-bold text-ms-muted hover:bg-ms-dark">Padrão</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuestionEditorDialog({ questao, onClose, onSalvo }: Props) {
  const [discipline, setDiscipline] = useState(questao?.discipline ?? '');
  const [level, setLevel] = useState(questao?.level ?? '');
  const [area, setArea] = useState(questao?.area ?? '');
  const [banca, setBanca] = useState(questao?.banca ?? '');
  const [orgao, setOrgao] = useState(questao?.orgao ?? '');
  const [cargo, setCargo] = useState(questao?.cargo ?? '');
  const [ano, setAno] = useState(questao?.ano ? String(questao.ano) : '');
  const [difficulty, setDifficulty] = useState(normalizarDificuldade(questao?.difficulty));
  const [assunto, setAssunto] = useState(questao?.assunto ?? '');
  const [topico, setTopico] = useState(questao?.topico ?? '');
  const [tipo, setTipo] = useState<TipoQuestao>(normalizarTipoQuestao(questao?.tipo));
  const [opcoes, setOpcoes] = useState<FilterOptions | null>(null);
  const [topicosDoAssunto, setTopicosDoAssunto] = useState<string[]>([]);
  const [criteriosCorrecao, setCriteriosCorrecao] = useState(questao?.criterios_correcao ?? '');
  const [linhasResposta, setLinhasResposta] = useState(questao?.linhas_resposta ? String(questao.linhas_resposta) : '');
  const [statement, setStatement] = useState(questao?.statement ?? '');
  const [textoApoio, setTextoApoio] = useState(questao?.support_texts?.content ?? '');
  const [alternatives, setAlternatives] = useState<Alternative[]>(
    questao?.alternatives?.length
      ? ordenarAlternativas(questao.alternatives)
      : [novaAlternativa('A'), novaAlternativa('B'), novaAlternativa('C'), novaAlternativa('D')]
  );
  const [correctLetter, setCorrectLetter] = useState(questao?.correct_letter ?? 'A');
  const [explanation, setExplanation] = useState(questao?.explanation ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escrita = ehQuestaoEscrita(tipo);

  useEffect(() => {
    buscarFilterOptions().then(setOpcoes).catch(() => setOpcoes(null));
  }, []);

  useEffect(() => {
    if (!assunto) {
      setTopicosDoAssunto([]);
      return;
    }
    let cancelado = false;
    buscarTopicosPorAssunto(assunto)
      .then((lista) => {
        if (!cancelado) setTopicosDoAssunto(lista);
      })
      .catch(() => {
        if (!cancelado) setTopicosDoAssunto([]);
      });
    return () => {
      cancelado = true;
    };
  }, [assunto]);

  function atualizarAlternativa(idx: number, texto: string) {
    setAlternatives((prev) => prev.map((a, i) => (i === idx ? { ...a, text: texto } : a)));
  }

  function adicionarAlternativa() {
    const proximaLetra = String.fromCharCode(65 + alternatives.length);
    setAlternatives((prev) => [...prev, novaAlternativa(proximaLetra)]);
  }

  function removerAlternativa(idx: number) {
    setAlternatives((prev) => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, letter: String.fromCharCode(65 + i) })));
  }

  async function handleSalvar() {
    if (!discipline.trim() || !statement.trim()) {
      setErro('Preencha disciplina e enunciado.');
      return;
    }
    if (!escrita && alternatives.some((a) => !a.text.trim())) {
      setErro('Preencha todas as alternativas.');
      return;
    }
    if (escrita && linhasResposta && Number(linhasResposta) < 1) {
      setErro('O número de linhas da resposta precisa ser maior que zero.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      // Texto associado é opcional: se preenchido, cria/atualiza o registro em support_texts
      // e grava o id na questão; se esvaziado, desvincula (não apaga o registro, que pode
      // estar em uso por outra questão).
      const supportTextId = textoApoio.trim()
        ? await salvarTextoApoio(questao?.support_text_id ?? null, discipline.trim(), textoApoio.trim())
        : null;

      const dados: Partial<Question> = {
        discipline: discipline.trim(),
        level: level.trim() || null,
        area: area.trim() || null,
        banca: banca.trim() || null,
        orgao: orgao.trim() || null,
        cargo: cargo.trim() || null,
        ano: ano ? Number(ano) : null,
        difficulty: difficulty.trim() || null,
        assunto: assunto.trim() || null,
        topico: topico.trim() || null,
        statement: statement.trim(),
        tipo,
        // O banco tem CHECK: dissertativa/redação exigem alternatives = [] e
        // correct_letter nulo; objetiva exige o contrário.
        alternatives: escrita ? [] : alternatives,
        correct_letter: escrita ? null : correctLetter,
        criterios_correcao: escrita ? criteriosCorrecao.trim() || null : null,
        linhas_resposta: escrita && linhasResposta ? Number(linhasResposta) : null,
        explanation: explanation.trim() || null,
        support_text_id: supportTextId,
        active: true,
      };
      if (questao) {
        await atualizarQuestao(questao.id, dados);
      } else {
        await criarQuestao(dados);
      }
      onSalvo();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : null);
      setErro(msg || 'Erro ao salvar questão.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-ms-card border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-ms-main">{questao ? 'Editar questão' : 'Nova questão'}</h3>
          <button onClick={onClose} className="text-ms-muted hover:text-ms-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wider text-ms-main">Tipo da questão</p>
          <div className="flex flex-wrap gap-2">
            {TIPOS_QUESTAO.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                aria-pressed={tipo === t}
                className={`px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${
                  tipo === t
                    ? 'bg-ms-blue border-ms-blueText text-white'
                    : 'border-gray-800 text-ms-muted hover:text-ms-main hover:border-ms-blueText'
                }`}
              >
                {TIPO_QUESTAO_LABEL[t]}
              </button>
            ))}
          </div>
          {escrita && (
            <p className="mt-1 text-xs text-ms-muted">
              Sem alternativas e sem gabarito: o aluno responde por escrito e a nota vem da correção do professor.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <AutocompleteField
            label="Disciplina *"
            placeholder="Disciplina *"
            value={discipline}
            onChange={setDiscipline}
            options={opcoes?.disciplines ?? []}
            allowCreate={false}
          />
          <AutocompleteField label="Nível" placeholder="Nível" value={level} onChange={setLevel} options={opcoes?.levels ?? []} />
          <AutocompleteField label="Área" placeholder="Área" value={area} onChange={setArea} options={opcoes?.areas ?? []} />
          <AutocompleteField
            label="Assunto"
            placeholder="Assunto"
            value={assunto}
            onChange={(v) => {
              setAssunto(v);
              if (v !== assunto) setTopico('');
            }}
            options={opcoes?.assuntos ?? []}
          />
          <AutocompleteField
            label="Tópico"
            placeholder={assunto ? 'Tópico' : 'Tópico (escolha o assunto)'}
            value={topico}
            onChange={setTopico}
            options={topicosDoAssunto}
            disabled={!assunto}
          />
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-ms-muted mb-1">Dificuldade</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputClass}>
              <option value="">Selecione...</option>
              {DIFICULDADES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-ms-muted mb-1">Ano</label>
            <input placeholder="Ano" value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ''))} className={inputClass} />
          </div>
          <AutocompleteField label="Banca" placeholder="Banca" value={banca} onChange={setBanca} options={opcoes?.bancas ?? []} />
          <AutocompleteField label="Órgão" placeholder="Órgão" value={orgao} onChange={setOrgao} options={opcoes?.orgaos ?? []} />
          <AutocompleteField label="Cargo" placeholder="Cargo" value={cargo} onChange={setCargo} options={opcoes?.cargos ?? []} />
        </div>

        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wider text-ms-main">Texto associado (opcional)</p>
          <CampoComMarcacao
            value={textoApoio}
            onChange={setTextoApoio}
            placeholder="Texto de apoio compartilhado por uma ou mais questões (opcional)"
            rows={20}
            onErro={setErro}
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wider text-ms-main">Enunciado *</p>
          <CampoComMarcacao value={statement} onChange={setStatement} placeholder="Enunciado *" rows={16} onErro={setErro} />
        </div>

        {escrita ? (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-ms-main">
                {discipline === 'Redação' ? 'Competências avaliadas' : 'Resposta esperada / critérios de correção'}
              </p>
              <CampoComMarcacao
                value={criteriosCorrecao}
                onChange={setCriteriosCorrecao}
                placeholder={
                  discipline === 'Redação'
                    ? 'Ex.: domínio da norma culta, coerência, proposta de intervenção...'
                    : 'O que a resposta do aluno precisa conter para valer a pontuação'
                }
                rows={4}
                onErro={setErro}
              />
            </div>
            <div className="max-w-xs">
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-ms-main">Linhas para a resposta</p>
              <input
                inputMode="numeric"
                placeholder={`Padrão: ${LINHAS_RESPOSTA_PADRAO[tipo]} linhas`}
                value={linhasResposta}
                onChange={(e) => setLinhasResposta(e.target.value.replace(/\D/g, ''))}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ms-muted">
                Quantas linhas pautadas sair na prova impressa. Em branco usa o padrão ({LINHAS_RESPOSTA_PADRAO[tipo]}).
              </p>
            </div>
          </div>
        ) : (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wider text-ms-main">Alternativas</p>
          {alternatives.map((alt, idx) => (
            <div key={alt.letter} className="flex items-start gap-2">
              <label className="flex items-center gap-1.5 shrink-0 pt-2.5">
                <input type="radio" name="gabarito" checked={correctLetter === alt.letter} onChange={() => setCorrectLetter(alt.letter)} />
                <span className="font-bold text-ms-main text-sm">{alt.letter}</span>
              </label>
              <div className="flex-1">
                <CampoComMarcacao
                  value={alt.text}
                  onChange={(v) => atualizarAlternativa(idx, v)}
                  placeholder={`Alternativa ${alt.letter}`}
                  rows={1}
                  showImage
                  showList={false}
                  onErro={setErro}
                />
              </div>
              {alternatives.length > 2 && (
                <button onClick={() => removerAlternativa(idx)} className="text-ms-muted hover:text-red-400 shrink-0 pt-2.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {alternatives.length < 6 && (
            <button onClick={adicionarAlternativa} className="flex items-center gap-1.5 text-sm font-bold text-ms-blueText hover:underline">
              <Plus className="w-4 h-4" /> Adicionar alternativa
            </button>
          )}
        </div>
        )}

        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wider text-ms-main">
            {escrita ? 'Observações para o professor (opcional)' : 'Explicação do gabarito (opcional)'}
          </p>
          <CampoComMarcacao value={explanation} onChange={setExplanation} placeholder="Explicação do gabarito (opcional)" rows={3} onErro={setErro} />
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-800 text-ms-muted font-bold">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-2 px-6 py-2.5 bg-ms-blue text-white rounded-xl font-bold hover:bg-blue-600 disabled:opacity-50"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
