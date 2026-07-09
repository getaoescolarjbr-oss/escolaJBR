import type { LucideIcon } from 'lucide-react';

// Badge de ícone padrão (fundo suave tom-sobre-tom + ícone lucide-react dentro) —
// mesmo formato já usado em telas mais antigas (AtaModal, AtestadoModal). Section
// headers de tela/card devem usar isto em vez de um ícone solto ao lado do título.
const CORES = {
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-500',
  red: 'bg-red-500/10 border-red-500/20 text-red-500',
  pink: 'bg-pink-500/10 border-pink-500/20 text-pink-500',
  teal: 'bg-teal-500/10 border-teal-500/20 text-teal-500',
  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-500',
  indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500',
  gray: 'bg-gray-500/10 border-gray-500/20 text-gray-400',
} as const;

export type CorSectionIcon = keyof typeof CORES;

interface SectionIconProps {
  icon: LucideIcon;
  cor?: CorSectionIcon;
  tamanho?: 'sm' | 'md';
}

export function SectionIcon({ icon: Icon, cor = 'blue', tamanho = 'sm' }: SectionIconProps) {
  const padding = tamanho === 'sm' ? 'p-1.5' : 'p-2.5';
  const iconSize = tamanho === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <span className={`inline-flex items-center justify-center rounded-lg border flex-shrink-0 ${padding} ${CORES[cor]}`}>
      <Icon className={iconSize} />
    </span>
  );
}
