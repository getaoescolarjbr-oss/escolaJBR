import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  ChevronDown,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  Loader2,
  Radical,
  Sigma,
  Subscript,
  Superscript,
  Underline,
} from 'lucide-react';
import katex from 'katex';
import { supabase } from '../../lib/supabase';

const GREGAS = ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'ρ', 'σ', 'φ', 'ω', 'Δ', 'Σ', 'Φ', 'Ω', 'Γ', 'Θ', 'Λ', 'Π', 'Ψ'];
const SETAS = ['→', '←', '↔', '⇒', '⇐', '⇔', '↑', '↓', '↦'];
const SIMBOLOS = ['±', '×', '÷', '≤', '≥', '≠', '≈', '≡', '√', '∞', '∑', '∏', '∫', '∂', '∆', '°', '²', '³', '½', '¼', '∅', '∈', '∉', '⊂', '∩', '∪', '∀', '∃'];

function ToolbarButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-1.5 text-ms-muted hover:bg-ms-dark hover:text-ms-main disabled:opacity-50"
    >
      {children}
    </button>
  );
}

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  folder: string;
  showImage?: boolean;
  showList?: boolean;
  onErro?: (msg: string) => void;
}

export function MarkupToolbar({ textareaRef, value, onChange, folder, showImage = true, showList = true, onErro }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [popover, setPopover] = useState<'simbolos' | 'equacao' | null>(null);
  const [latexEquacao, setLatexEquacao] = useState('');
  const latexRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popover) return;
    function handleClickFora(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [popover]);

  function calcularPreview(): string {
    try {
      return katex.renderToString(latexEquacao || ' ', { throwOnError: false, output: 'html' });
    } catch {
      return '';
    }
  }
  const previewEquacao = calcularPreview();

  function getSelection() {
    const el = textareaRef.current;
    if (!el) return null;
    return { el, start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length };
  }

  function wrapSelection(tag: string) {
    const sel = getSelection();
    if (!sel) return;
    const { el, start, end } = sel;
    const selecionado = value.slice(start, end);
    onChange(`${value.slice(0, start)}<${tag}>${selecionado}</${tag}>${value.slice(end)}`);
    const novoInicio = start + tag.length + 2;
    const novoFim = novoInicio + selecionado.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(novoInicio, novoFim);
    });
  }

  function insertAtCursor(texto: string) {
    const sel = getSelection();
    if (!sel) return;
    const { el, start, end } = sel;
    onChange(`${value.slice(0, start)}${texto}${value.slice(end)}`);
    const pos = start + texto.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function inserirMarcador(nivel: 1 | 2 | 3) {
    const sel = getSelection();
    if (!sel) return;
    const { el, start } = sel;
    const marcadores = ['• ', '   ◦ ', '      ▪ '];
    const marcador = marcadores[nivel - 1];
    const inicioLinha = value.lastIndexOf('\n', start - 1) + 1;
    onChange(`${value.slice(0, inicioLinha)}${marcador}${value.slice(inicioLinha)}`);
    const pos = start + marcador.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function inserirNoLatex(antes: string, depois = '') {
    const el = latexRef.current;
    const start = el?.selectionStart ?? latexEquacao.length;
    const end = el?.selectionEnd ?? latexEquacao.length;
    const selecionado = latexEquacao.slice(start, end);
    const novo = `${latexEquacao.slice(0, start)}${antes}${selecionado}${depois}${latexEquacao.slice(end)}`;
    setLatexEquacao(novo);
    const pos = start + antes.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos + selecionado.length);
    });
  }

  function abrirEditorEquacao() {
    setLatexEquacao('');
    setPopover('equacao');
  }

  function confirmarEquacao() {
    if (!latexEquacao.trim()) {
      setPopover(null);
      return;
    }
    insertAtCursor(`[[EQ:${latexEquacao.trim()}]]`);
    setPopover(null);
    setLatexEquacao('');
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('imagens-questoes').upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('imagens-questoes').getPublicUrl(path);
      insertAtCursor(`\n[[IMG:${data.publicUrl}]]\n`);
    } catch (err) {
      onErro?.(err instanceof Error ? err.message : 'Falha ao enviar imagem');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div ref={toolbarRef} className="relative flex flex-wrap items-center gap-0.5 rounded-lg border border-gray-800 bg-ms-dark/40 p-1">
      <ToolbarButton title="Negrito" onClick={() => wrapSelection('strong')}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Itálico" onClick={() => wrapSelection('em')}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Sublinhado" onClick={() => wrapSelection('u')}>
        <Underline className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Destaque" onClick={() => wrapSelection('mark')}>
        <Highlighter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Subscrito" onClick={() => wrapSelection('sub')}>
        <Subscript className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Sobrescrito" onClick={() => wrapSelection('sup')}>
        <Superscript className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-gray-800" />

      <div className="relative">
        <ToolbarButton title="Inserir equação (fração, raiz, expoente...)" onClick={() => (popover === 'equacao' ? setPopover(null) : abrirEditorEquacao())}>
          <Radical className="h-3.5 w-3.5" />
        </ToolbarButton>
        {popover === 'equacao' && (
          <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-xl border border-gray-800 bg-ms-card p-3 shadow-xl">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ms-muted">Modelos</p>
            <div className="mb-2 flex flex-wrap gap-1">
              <button type="button" title="Fração" onClick={() => inserirNoLatex('\\frac{', '}{}')} className="px-2 py-1 rounded-lg text-xs font-bold text-ms-main hover:bg-ms-dark border border-gray-800">
                a/b
              </button>
              <button type="button" title="Raiz quadrada" onClick={() => inserirNoLatex('\\sqrt{', '}')} className="px-2 py-1 rounded-lg text-xs font-bold text-ms-main hover:bg-ms-dark border border-gray-800">
                √x
              </button>
              <button type="button" title="Raiz n-ésima" onClick={() => inserirNoLatex('\\sqrt[n]{', '}')} className="px-2 py-1 rounded-lg text-xs font-bold text-ms-main hover:bg-ms-dark border border-gray-800">
                ⁿ√x
              </button>
              <button type="button" title="Expoente" onClick={() => inserirNoLatex('^{', '}')} className="px-2 py-1 rounded-lg text-xs font-bold text-ms-main hover:bg-ms-dark border border-gray-800">
                xⁿ
              </button>
              <button type="button" title="Índice" onClick={() => inserirNoLatex('_{', '}')} className="px-2 py-1 rounded-lg text-xs font-bold text-ms-main hover:bg-ms-dark border border-gray-800">
                xₙ
              </button>
              <button type="button" title="Somatório" onClick={() => inserirNoLatex('\\sum_{i=1}^{n} ')} className="px-2 py-1 rounded-lg text-xs font-bold text-ms-main hover:bg-ms-dark border border-gray-800">
                Σ
              </button>
              <button type="button" title="Integral" onClick={() => inserirNoLatex('\\int_{a}^{b} ')} className="px-2 py-1 rounded-lg text-xs font-bold text-ms-main hover:bg-ms-dark border border-gray-800">
                ∫
              </button>
              <button type="button" title="Letra grega" onClick={() => inserirNoLatex('\\alpha')} className="px-2 py-1 rounded-lg text-xs font-bold text-ms-main hover:bg-ms-dark border border-gray-800">
                α
              </button>
            </div>

            <textarea
              ref={latexRef}
              value={latexEquacao}
              onChange={(e) => setLatexEquacao(e.target.value)}
              placeholder="Ex.: \frac{x}{2} + \sqrt{y}"
              rows={2}
              className="w-full px-2 py-1.5 bg-ms-dark border border-gray-800 rounded-lg text-ms-main text-xs font-mono outline-none focus:ring-2 focus:ring-ms-blue resize-y"
            />

            <p className="mt-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-ms-muted">Pré-visualização</p>
            <div className="min-h-[2.5rem] rounded-lg border border-gray-800 bg-ms-dark/60 px-3 py-2 text-ms-main overflow-x-auto">
              {latexEquacao.trim() ? (
                <span dangerouslySetInnerHTML={{ __html: previewEquacao }} />
              ) : (
                <span className="text-xs text-ms-muted">A prévia aparece aqui...</span>
              )}
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setPopover(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-ms-muted hover:bg-ms-dark">
                Cancelar
              </button>
              <button type="button" onClick={confirmarEquacao} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-ms-blue text-white hover:bg-blue-600">
                Inserir
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <ToolbarButton title="Letras gregas, setas e símbolos matemáticos" onClick={() => setPopover((p) => (p === 'simbolos' ? null : 'simbolos'))}>
          <span className="flex items-center gap-0.5">
            <Sigma className="h-3.5 w-3.5" />
            <ChevronDown className="h-2.5 w-2.5" />
          </span>
        </ToolbarButton>
        {popover === 'simbolos' && (
          <div className="absolute left-0 top-full z-10 mt-1 w-72 rounded-xl border border-gray-800 bg-ms-card p-3 shadow-xl">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ms-muted">Letras gregas</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {GREGAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => insertAtCursor(s)}
                  className="w-7 h-7 rounded-lg text-sm text-ms-main hover:bg-ms-dark"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ms-muted">Setas</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {SETAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => insertAtCursor(s)}
                  className="w-7 h-7 rounded-lg text-sm text-ms-main hover:bg-ms-dark"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ms-muted">Símbolos matemáticos</p>
            <div className="flex flex-wrap gap-1">
              {SIMBOLOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => insertAtCursor(s)}
                  className="w-7 h-7 rounded-lg text-sm text-ms-main hover:bg-ms-dark"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showList && (
        <>
          <div className="mx-1 h-4 w-px bg-gray-800" />
          <ToolbarButton title="Marcador nível 1" onClick={() => inserirMarcador(1)}>
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Marcador nível 2 (indentado)" onClick={() => inserirMarcador(2)}>
            <span className="pl-1.5 text-xs font-bold">◦</span>
          </ToolbarButton>
          <ToolbarButton title="Marcador nível 3 (indentado)" onClick={() => inserirMarcador(3)}>
            <span className="pl-3 text-xs font-bold">▪</span>
          </ToolbarButton>
        </>
      )}

      {showImage && (
        <>
          <div className="mx-1 h-4 w-px bg-gray-800" />
          <ToolbarButton title="Inserir imagem" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          </ToolbarButton>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFile(e.target.files?.[0])} />
        </>
      )}
    </div>
  );
}
