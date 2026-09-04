import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Permite criar um valor novo digitando algo que ainda não existe em `options`. */
  allowCreate?: boolean;
}

// Campo de texto com sugestões: ao digitar, filtra as opções já cadastradas (evita erro de
// digitação em disciplina/assunto/banca/etc.) e, se o texto digitado não bater com nenhuma
// opção, oferece "Criar novo valor" pra cadastrar na hora, sem precisar ir em Categorias.
export function AutocompleteField({ label, value, onChange, options, placeholder, disabled, allowCreate = true }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDraft(value);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [draft, options]);

  const draftTrimmed = draft.trim();
  const hasExactMatch = options.some((o) => o.toLowerCase() === draftTrimmed.toLowerCase());
  const canCreate = allowCreate && draftTrimmed.length > 0 && !hasExactMatch;

  function select(v: string) {
    onChange(v);
    setDraft(v);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-[10px] font-black uppercase tracking-wider text-ms-muted mb-1">{label}</label>
      <input
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // sem valor exato e sem permissão de criar: volta pro último valor válido
          if (!allowCreate && draft.trim() && !hasExactMatch) setDraft(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length > 0) select(filtered[0]);
            else if (canCreate) select(draftTrimmed);
          }
          if (e.key === 'Escape') {
            setOpen(false);
            setDraft(value);
          }
        }}
        className="w-full px-4 py-2.5 bg-ms-dark border border-gray-800 rounded-xl text-ms-main text-sm outline-none focus:ring-2 focus:ring-ms-blue disabled:opacity-50"
      />
      {open && !disabled && (filtered.length > 0 || canCreate) && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-ms-card border border-gray-800 rounded-xl shadow-lg py-1">
          {value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select('')}
              className="w-full text-left px-3 py-1.5 text-xs text-ms-muted hover:bg-gray-800/60"
            >
              Limpar seleção
            </button>
          )}
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(opt)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800/60 ${
                opt === value ? 'text-ms-blueText font-bold' : 'text-ms-main'
              }`}
            >
              {opt}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(draftTrimmed)}
              className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-sm font-bold text-ms-blueText hover:bg-gray-800/60"
            >
              <Plus className="w-3.5 h-3.5" /> Criar "{draftTrimmed}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
